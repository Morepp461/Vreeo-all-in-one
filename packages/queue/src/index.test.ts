import { describe, expect, it } from "vitest";
import {
  DEFAULT_BACKOFF_DELAY_MS,
  DEFAULT_JOB_ATTEMPTS,
  createIdempotentJobId,
  defaultQueueJobOptions,
} from "./index.js";

describe("queue policy", () => {
  it("uses finite retries with exponential backoff and retains failures", () => {
    expect(defaultQueueJobOptions()).toMatchObject({
      attempts: DEFAULT_JOB_ATTEMPTS,
      backoff: { type: "exponential", delay: DEFAULT_BACKOFF_DELAY_MS },
      removeOnComplete: 1_000,
      removeOnFail: false,
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
    expect(() => defaultQueueJobOptions()).not.toThrow();
    expect(() => createIdempotentJobId("invalid:queue", "key")).toThrow(/Queue names/);
    expect(() => createIdempotentJobId("valid-queue", " ")).toThrow(/Idempotency key/);
  });
});
