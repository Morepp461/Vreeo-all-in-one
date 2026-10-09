import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildServer } from "./server.js";

describe("API server", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("exposes liveness without claiming dependency readiness", async () => {
    app = await buildServer({ loggerOptions: { level: "silent" } });
    const live = await app.inject({ method: "GET", url: "/health" });
    expect(live.statusCode).toBe(200);
    expect(live.json()).toMatchObject({ status: "ok", service: "api" });

    const ready = await app.inject({ method: "GET", url: "/health/ready" });
    expect(ready.statusCode).toBe(503);
    expect(ready.json()).toMatchObject({
      status: "not_ready",
      checks: [{ name: "dependencies", status: "not_configured" }],
    });
  });

  it("returns a consistent error for unknown routes", async () => {
    app = await buildServer({ loggerOptions: { level: "silent" } });
    const response = await app.inject({ method: "GET", url: "/missing" });
    expect(response.statusCode).toBe(404);
    expect(response.json().error).toMatchObject({
      code: "NOT_FOUND",
      message: "The requested resource was not found.",
    });
    expect(response.json().error.requestId).toBeTruthy();
  });

  it("does not trust malformed caller-supplied request IDs", async () => {
    app = await buildServer({ loggerOptions: { level: "silent" } });
    const response = await app.inject({
      method: "GET",
      url: "/missing",
      headers: { "x-request-id": "client supplied id" },
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.requestId).not.toBe("client supplied id");
    expect(response.json().error.requestId).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("fails readiness without leaking dependency errors", async () => {
    app = await buildServer({
      loggerOptions: { level: "silent" },
      readinessChecks: [{ name: "database", check: async () => { throw new Error("internal secret"); } }],
    });
    const response = await app.inject({ method: "GET", url: "/health/ready" });
    expect(response.statusCode).toBe(503);
    expect(response.body).not.toContain("internal secret");
    expect(response.json().checks).toEqual([{ name: "database", status: "unavailable" }]);
  });

  it("reports ready only when every registered dependency check succeeds", async () => {
    app = await buildServer({
      loggerOptions: { level: "silent" },
      readinessChecks: [
        { name: "database", check: async () => undefined },
        { name: "redis", check: async () => undefined },
      ],
    });
    const response = await app.inject({ method: "GET", url: "/health/ready" });
    expect(response.statusCode).toBe(200);
    expect(response.json().checks).toEqual([
      { name: "database", status: "ok" },
      { name: "redis", status: "ok" },
    ]);
  });
});
