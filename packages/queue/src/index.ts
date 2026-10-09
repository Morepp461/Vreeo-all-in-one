import { createHash } from "node:crypto";
import { Queue, Worker, type JobsOptions, type Processor } from "bullmq";
import type { Logger } from "pino";
import { buildRedisKey, type RedisConnection } from "@vreeo/redis";
import type { Job } from "bullmq";

export const QUEUE_PREFIX = "vreeo:queue";
export type VreeoQueue<TData = unknown> = Queue<TData, unknown, string>;
export const DEFAULT_JOB_ATTEMPTS = 5;
export const DEFAULT_BACKOFF_DELAY_MS = 1_000;

export interface DeadLetterJobData {
  originalQueue: string;
  originalJobId: string;
  originalJobName: string;
  attemptsMade: number;
  failedAt: string;
  errorName: string;
  payloadReference: string;
}

export interface AddIdempotentJobOptions extends JobsOptions {
  idempotencyTtlSeconds?: number;
}

export interface CreateQueueOptions {
  defaultJobOptions?: JobsOptions;
}

export function defaultQueueJobOptions(overrides: JobsOptions = {}): JobsOptions {
  return {
    attempts: DEFAULT_JOB_ATTEMPTS,
    backoff: { type: "exponential", delay: DEFAULT_BACKOFF_DELAY_MS },
    removeOnComplete: 1_000,
    removeOnFail: 1_000,
    ...overrides,
  };
}

function assertQueueName(name: string): void {
  if (!/^[A-Za-z0-9_-]{1,95}$/.test(name)) {
    throw new Error("Queue names may contain only letters, numbers, underscores, and hyphens");
  }
}

export function createQueue<TData = unknown>(
  name: string,
  connection: RedisConnection,
  options: CreateQueueOptions = {},
): VreeoQueue<TData> {
  assertQueueName(name);
  return new Queue<TData, unknown, string>(name, {
    connection,
    prefix: QUEUE_PREFIX,
    defaultJobOptions: defaultQueueJobOptions(options.defaultJobOptions),
  });
}

export function buildDeadLetterQueueName(queueName: string): string {
  assertQueueName(queueName);
  return queueName.length <= 91
    ? `${queueName}-dlq`
    : `dlq-${createHash("sha256").update(queueName).digest("hex").slice(0, 40)}`;
}

export function createIdempotentJobId(queueName: string, idempotencyKey: string): string {
  assertQueueName(queueName);
  if (idempotencyKey.trim().length === 0) {
    throw new Error("Idempotency key must be non-empty");
  }
  const digest = createHash("sha256").update(queueName).update("\0").update(idempotencyKey).digest("hex");
  return `idem-${digest}`;
}

export type IdempotentEnqueueResult<TData> =
  | { accepted: true; jobId: string; job: Job<TData, unknown, string> }
  | { accepted: false; jobId: string; reason: "duplicate" };

const releaseIdempotencyKeyScript = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0
`;

export async function addIdempotentJob<TData>(
  queue: VreeoQueue<TData>,
  connection: RedisConnection,
  jobName: string,
  data: TData,
  idempotencyKey: string,
  options: AddIdempotentJobOptions = {},
): Promise<IdempotentEnqueueResult<TData>> {
  const { idempotencyTtlSeconds = 86_400, ...jobOptions } = options;
  if (!Number.isSafeInteger(idempotencyTtlSeconds) || idempotencyTtlSeconds <= 0) {
    throw new Error("Idempotency TTL must be a positive integer number of seconds");
  }

  const jobId = createIdempotentJobId(queue.name, idempotencyKey);
  const key = buildRedisKey("queue-idempotency", queue.name, jobId);
  const claimed = await connection.set(key, jobId, "EX", idempotencyTtlSeconds, "NX");
  if (claimed !== "OK") {
    const existingJobId = await connection.get(key);
    if (existingJobId) return { accepted: false, jobId: existingJobId, reason: "duplicate" };
    // The marker may have expired between SET NX and GET. Make one bounded retry.
    const retryClaim = await connection.set(key, jobId, "EX", idempotencyTtlSeconds, "NX");
    if (retryClaim !== "OK") {
      const racedJobId = await connection.get(key);
      if (racedJobId) return { accepted: false, jobId: racedJobId, reason: "duplicate" };
      throw new Error("Could not reserve the queue idempotency key");
    }
  }

  try {
    // The generic helper intentionally accepts arbitrary job names across payload types.
    const job = await queue.add(jobName as never, data as never, { ...jobOptions, jobId });
    return { accepted: true, jobId, job: job as unknown as Job<TData, unknown, string> };
  } catch (error) {
    await connection.eval(releaseIdempotencyKeyScript, 1, key, jobId);
    throw error;
  }
}

export interface QueueWorkerHandle<TData = unknown, TResult = unknown> {
  worker: Worker<TData, TResult, string>;
  deadLetterQueue: VreeoQueue<DeadLetterJobData>;
  close(): Promise<void>;
}

export interface CreateQueueWorkerOptions {
  concurrency?: number;
  logger?: Pick<Logger, "error" | "warn">;
}

export function createQueueWorker<TData = unknown, TResult = unknown>(
  queueName: string,
  connection: RedisConnection,
  processor: Processor<TData, TResult, string>,
  options: CreateQueueWorkerOptions = {},
): QueueWorkerHandle<TData, TResult> {
  assertQueueName(queueName);
  if (!Number.isSafeInteger(options.concurrency ?? 5) || (options.concurrency ?? 5) <= 0) {
    throw new Error("Worker concurrency must be a positive integer");
  }
  const logger = options.logger;
  const pendingDeadLetterWrites = new Set<Promise<void>>();
  const deadLetterQueue = createQueue<DeadLetterJobData>(buildDeadLetterQueueName(queueName), connection);
  const worker = new Worker<TData, TResult, string>(queueName, processor, {
    connection,
    prefix: QUEUE_PREFIX,
    concurrency: options.concurrency ?? 5,
  });

  worker.on("error", (error) => {
    logger?.error({ err: error, queue: queueName }, "Queue worker emitted an error");
  });

  worker.on("failed", (job, error) => {
    if (!job) return;
    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < maxAttempts) {
      logger?.warn({ queue: queueName, jobId: job.id, attemptsMade: job.attemptsMade, maxAttempts, errorName: error.name }, "Queue job failed; retry may follow");
      return;
    }

    const deadLetter: DeadLetterJobData = {
      originalQueue: queueName,
      originalJobId: String(job.id),
      originalJobName: job.name,
      attemptsMade: job.attemptsMade,
      failedAt: new Date().toISOString(),
      errorName: /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(error.name) ? error.name : "Error",
      payloadReference: `${queueName}:${String(job.id)}`,
    };
    const deadLetterJobId = `dlq-${createHash("sha256").update(deadLetter.payloadReference).digest("hex")}`;

    const pendingWrite = deadLetterQueue.add("dead-letter" as never, deadLetter as never, { jobId: deadLetterJobId })
      .then(() => {
        logger?.error({
          queue: queueName,
          jobId: job.id,
          attempts: job.attemptsMade,
          errorName: deadLetter.errorName,
        }, "Job moved to dead-letter queue");
      })
      .catch((deadLetterError: unknown) => {
        logger?.error({
          err: deadLetterError,
          queue: queueName,
          jobId: job.id,
        }, "Failed to enqueue dead-letter record");
      });
    pendingDeadLetterWrites.add(pendingWrite);
    void pendingWrite.finally(() => pendingDeadLetterWrites.delete(pendingWrite));
  });

  return {
    worker,
    deadLetterQueue,
    async close() {
      await worker.close();
      await Promise.all([...pendingDeadLetterWrites]);
      await deadLetterQueue.close();
    },
  };
}
