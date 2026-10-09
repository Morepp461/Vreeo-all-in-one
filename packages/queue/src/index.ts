import { createHash } from "node:crypto";
import { Queue, Worker, type JobsOptions, type Processor } from "bullmq";
import type { Logger } from "pino";
import type { RedisConnection } from "@vreeo/redis";

export const QUEUE_PREFIX = "vreeo:queue";
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

export interface CreateQueueOptions {
  defaultJobOptions?: JobsOptions;
}

export function defaultQueueJobOptions(overrides: JobsOptions = {}): JobsOptions {
  return {
    attempts: DEFAULT_JOB_ATTEMPTS,
    backoff: { type: "exponential", delay: DEFAULT_BACKOFF_DELAY_MS },
    removeOnComplete: 1_000,
    removeOnFail: false,
    ...overrides,
  };
}

function assertQueueName(name: string): void {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(name)) {
    throw new Error("Queue names may contain only letters, numbers, underscores, and hyphens");
  }
}

export function createQueue<TData = unknown>(
  name: string,
  connection: RedisConnection,
  options: CreateQueueOptions = {},
): Queue<TData, unknown, string> {
  assertQueueName(name);
  return new Queue<TData, unknown, string>(name, {
    connection,
    prefix: QUEUE_PREFIX,
    defaultJobOptions: defaultQueueJobOptions(options.defaultJobOptions),
  });
}

export function createIdempotentJobId(queueName: string, idempotencyKey: string): string {
  assertQueueName(queueName);
  if (idempotencyKey.trim().length === 0) {
    throw new Error("Idempotency key must be non-empty");
  }
  const digest = createHash("sha256").update(queueName).update("\0").update(idempotencyKey).digest("hex");
  return `idem-${digest}`;
}

export async function addIdempotentJob<TData>(
  queue: Queue<TData, unknown, string>,
  jobName: string,
  data: TData,
  idempotencyKey: string,
  options: JobsOptions = {},
) {
  return queue.add(jobName, data, {
    ...options,
    jobId: createIdempotentJobId(queue.name, idempotencyKey),
  });
}

export interface QueueWorkerHandle<TData = unknown, TResult = unknown> {
  worker: Worker<TData, TResult, string>;
  deadLetterQueue: Queue<DeadLetterJobData, unknown, string>;
  close(): Promise<void>;
}

export interface CreateQueueWorkerOptions {
  concurrency?: number;
  logger?: Pick<Logger, "error">;
}

export function createQueueWorker<TData = unknown, TResult = unknown>(
  queueName: string,
  connection: RedisConnection,
  processor: Processor<TData, TResult, string>,
  options: CreateQueueWorkerOptions = {},
): QueueWorkerHandle<TData, TResult> {
  assertQueueName(queueName);
  const logger = options.logger;
  const deadLetterQueue = createQueue<DeadLetterJobData>(`${queueName}-dlq`, connection);
  const worker = new Worker<TData, TResult, string>(queueName, processor, {
    connection,
    prefix: QUEUE_PREFIX,
    concurrency: options.concurrency ?? 5,
  });

  worker.on("failed", (job, error) => {
    if (!job) return;
    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < maxAttempts) return;

    const deadLetter: DeadLetterJobData = {
      originalQueue: queueName,
      originalJobId: String(job.id),
      originalJobName: job.name,
      attemptsMade: job.attemptsMade,
      failedAt: new Date().toISOString(),
      errorName: error.name || "Error",
      payloadReference: `${queueName}:${String(job.id)}`,
    };
    const deadLetterJobId = `dlq-${createHash("sha256").update(deadLetter.payloadReference).digest("hex")}`;

    void deadLetterQueue.add("dead-letter", deadLetter, { jobId: deadLetterJobId })
      .then(() => logger?.error({
        queue: queueName,
        jobId: job.id,
        attempts: job.attemptsMade,
        errorName: deadLetter.errorName,
      }, "Job moved to dead-letter queue"))
      .catch((deadLetterError: unknown) => logger?.error({
        err: deadLetterError,
        queue: queueName,
        jobId: job.id,
      }, "Failed to enqueue dead-letter record"));
  });

  return {
    worker,
    deadLetterQueue,
    async close() {
      await Promise.all([worker.close(), deadLetterQueue.close()]);
    },
  };
}
