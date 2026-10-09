import { createLogger } from "@vreeo/logger";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildServer } from "./server.js";

describe("API server", () => {
  let app: FastifyInstance | undefined;
  afterEach(async () => { await app?.close(); app = undefined; });

  it("exposes liveness without claiming dependency readiness", async () => {
    app = await buildServer({ logger: createLogger({ service: "api-test", level: "silent" }) });
    const live = await app.inject({ method: "GET", url: "/health" });
    expect(live.statusCode).toBe(200);
    expect(live.json()).toMatchObject({ status: "ok", service: "api" });
    const ready = await app.inject({ method: "GET", url: "/health/ready" });
    expect(ready.statusCode).toBe(503);
    expect(ready.json()).toMatchObject({ status: "not_ready", checks: [{ status: "not_configured" }] });
  });

  it("returns a consistent error for unknown routes", async () => {
    app = await buildServer({ logger: createLogger({ service: "api-test", level: "silent" }) });
    const response = await app.inject({ method: "GET", url: "/missing" });
    expect(response.statusCode).toBe(404);
    expect(response.json().error).toMatchObject({ code: "NOT_FOUND", message: "The requested resource was not found." });
    expect(response.json().error.requestId).toBeTruthy();
  });

  it("fails readiness without leaking dependency errors", async () => {
    app = await buildServer({
      logger: createLogger({ service: "api-test", level: "silent" }),
      readinessChecks: [{ name: "database", check: async () => { throw new Error("internal secret"); } }],
    });
    const response = await app.inject({ method: "GET", url: "/health/ready" });
    expect(response.statusCode).toBe(503);
    expect(response.body).not.toContain("internal secret");
    expect(response.json().checks).toEqual([{ name: "database", status: "unavailable" }]);
  });
});
