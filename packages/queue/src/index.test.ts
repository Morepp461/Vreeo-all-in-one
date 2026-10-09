import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger } from "@vreeo/logger";
import { closeRedisConnection, createRedisConnection } from "@vreeo/redis";
import { addIdempotentJob, createIdempotentJobId, createQueue, createQueueWorker, defaultQueueJobOptions, DEFAULT_BACKOFF_DELAY_MS, DEFAULT_JOB_ATTEMPTS } from "./index.js";

const redis = createRedisConnection({
  url: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
});

beforeAll(async () => {
  await redis.ping();
});

afterAll(async () => {
  await closeRedisConnection(redis);
});

describe("queue policy", () => {
  it("uses finite retries, exponential backoff, and bounded failed-job retention", () => {
    expect(defaultQueueJobOptions()).toMatchObject({
      attempts: DEFAULT_JOB_ATTEMPTS,
      backoff: { type: "exponential", delay: DEFAULT_BACKOFF_DELAY_MS },
      removeOnComplete: 1_000,
      removeOnFail: 1_000,
    });
  });

  it("generates deterministic, non-secret idempotency identifiers", () => {
    const first = createIdempotentJobId("moderation-warn", "request-123");
    expect(first).toBe(createIdempotentJobId("moderation-warn", "request-123"));
    expect(first).not.toBe(createIdempotentJobId("moderation-warn", "request-456"));
    expect(first).not.toContain(":");
    expect(first).not.toContain("request-123");
  });

  it("rejects invalid queue names and empty idempotency keys", () => {
    expect(() => createIdempotentJobId("invalid:queue", "key")).toThrow(/Queue names/);
    expect(() => createIdempotentJobId("valid-queue", " ")).toThrow(/Idempotency key/);
  });

  it("deduplicates enqueue requests with the same idempotency key", async () => {
    const queueName = `test-idem-${randomUUID().replace(/-/g, "")}`;
    const queue = createQueue<{ value: string }>(queueName, redis);
    try {
      const first = await addIdempotentJob(queue, "test-job", { value: "one" }, "same-request");
      const second = await addIdempotentJob(queue, "test-job", { value: "two" }, "same-request");
      expect(second.id).toBe(first.id);
      expect(await queue.getWaitingCount()).toBe(1);
    } finally {
      await queue.obliterate({ force: true });
      await queue.close();
    }
  });

  it("retries failed work and records a payload-free dead-letter reference", async () => {
    const queueName = `test-dlq-${randomUUID().replace(/-/g, "")}`;
    const queue = createQueue<{ secret: string }>(queueName, redis, {
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "fixed", delay: 1 },
        removeOnComplete: 10,
        removeOnFail: 1_000,
      },
    });
    let attempts = 0;
    const handle = createQueueWorker<{ secret: string }, never>(
      queueName,
      redis,
      async () => {
        attempts += 1;
        throw new Error("private failure detail");
      },
      { concurrency: 1, logger: createLogger({ service: "queue-test", level: "silent" }) },
    );

    try {
      await queue.add("always-fail", { secret: "private-payload" });
      const deadline = Date.now() + 5_000;
      let deadLetterJobs = await handle.deadLetterQueue.getJobs(["waiting", "delayed", "active"], 0, 10);
      while (deadLetterJobs.length === 0 && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 25));
        deadLetterJobs = await handle.deadLetterQueue.getJobs(["waiting", "delayed", "active"], 0, 10);
      }

      expect(deadLetterJobs).toHaveLength(1);
      expect(attempts).toBe(2);
      const data = deadLetterJobs[0]?.data;
      expect(data).toMatchObject({
        originalQueue: queueName,
        originalJobName: "always-fail",
        attemptsMade: 2,
        errorName: "Error",
      });
      expect(JSON.stringify(data)).not.toContain("private-payload");
      expect(JSON.stringify(data)).not.toContain("private failure detail");
    } finally {
      await handle.deadLetterQueue.obliterate({ force: true });
      await handle.close();
      await queue.obliterate({ force: true });
      await queue.close();
    }
  });
});
