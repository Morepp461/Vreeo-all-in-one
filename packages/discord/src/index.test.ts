import { describe, expect, it } from "vitest";
import { assertBotHierarchy, assertDiscordPermissions, DiscordRestService, DiscordServiceError, normalizeDiscordError, type DiscordRestTransport } from "./index.js";

describe("Discord service boundary", () => {
  it("normalizes rate limits, missing resources, and permission errors", () => {
    expect(normalizeDiscordError({ status: 429 }).code).toBe("DISCORD_RATE_LIMITED");
    expect(normalizeDiscordError({ statusCode: 404 }).code).toBe("DISCORD_RESOURCE_NOT_FOUND");
    expect(normalizeDiscordError({ status: 403 }).code).toBe("DISCORD_PERMISSION_MISSING");
    expect(normalizeDiscordError(new Error("private internal message")).message).toBe("Discord request failed.");
  });
  it("checks bot role hierarchy and required permissions before a mutation", () => {
    expect(() => assertBotHierarchy({ botHighestRolePosition: 10, targetHighestRolePosition: 5, targetRoleManaged: false })).not.toThrow();
    expect(() => assertBotHierarchy({ botHighestRolePosition: 5, targetHighestRolePosition: 5, targetRoleManaged: false })).toThrowError(DiscordServiceError);
    expect(() => assertBotHierarchy({ botHighestRolePosition: 10, targetHighestRolePosition: 5, targetRoleManaged: true })).toThrow(/role hierarchy/);
    expect(() => assertDiscordPermissions(["BanMembers"], ["ViewChannel"])).toThrow(/required Discord permission/);
  });
  it("normalizes failures without logging raw error messages or request payloads", async () => {
    const messages: string[] = [];
    const metrics: boolean[] = [];
    const transport: DiscordRestTransport = { async request<T>() { throw new Error("secret payload should not be logged"); } };
    const service = new DiscordRestService(transport, {
      logger: {
        info: (_bindings, message) => { messages.push(message); },
        warn: (_bindings, message) => { messages.push(message); },
      },
      onRequestMetric: (metric) => { metrics.push(metric.success); },
    });
    await expect(service.request({ method: "POST", route: "/guilds/123/bans/456", options: { body: { token: "do-not-log" } }, context: { operation: "moderation.ban", guildId: "guild-1", correlationId: "req-1" } }))
      .rejects.toMatchObject({ code: "DISCORD_API_ERROR", message: "Discord request failed." });
    expect(messages).toEqual(["Discord REST request failed"]);
    expect(metrics).toEqual([false]);
  });
  it("returns transport responses and isolates telemetry callback failures", async () => {
    const transport: DiscordRestTransport = { async request<T>() { return { ok: true } as T; } };
    const service = new DiscordRestService(transport, { onRequestMetric: () => { throw new Error("metrics unavailable"); } });
    await expect(service.request({ method: "GET", route: "/users/@me", context: { operation: "identity.current" } })).resolves.toEqual({ ok: true });
  });
});
