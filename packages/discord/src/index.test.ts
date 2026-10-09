import { describe, expect, it } from "vitest";
import { assertBotHierarchy, assertDiscordPermissions, DiscordRestService, DiscordServiceError, fetchLiveDiscordPermissionSnapshot, hasLiveDiscordPermission, normalizeDiscordError, type DiscordRestTransport } from "./index.js";

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

  it("revalidates live guild membership and combines the everyone and assigned role permission bitfields", async () => {
    const calls: string[] = [];
    const responses: Record<string, unknown> = {
      "/guilds/123456789012345678": { id: "123456789012345678", owner_id: "999999999999999999" },
      "/guilds/123456789012345678/roles": [
        { id: "123456789012345678", permissions: "1024" },
        { id: "222222222222222222", permissions: "2048" },
        { id: "333333333333333333", permissions: "0" },
      ],
      "/guilds/123456789012345678/members/444444444444444444": {
        user: { id: "444444444444444444" }, roles: ["222222222222222222", "333333333333333333"],
      },
    };
    const transport: DiscordRestTransport = {
      async request<T>(_method, route) {
        calls.push(route);
        if (!(route in responses)) throw new Error("unexpected route");
        return responses[route] as T;
      },
    };
    const snapshot = await fetchLiveDiscordPermissionSnapshot(new DiscordRestService(transport), {
      guildId: "123456789012345678", actorDiscordUserId: "444444444444444444",
    });
    expect(calls).toHaveLength(3);
    expect(snapshot.roleIds).toEqual(["222222222222222222", "333333333333333333"]);
    expect(snapshot.permissionBits).toBe(3072n);
    expect(hasLiveDiscordPermission(snapshot, 1024n)).toBe(false);
    expect(hasLiveDiscordPermission(snapshot, 2048n)).toBe(true);
    expect(hasLiveDiscordPermission(snapshot, 3072n)).toBe(true);
  });

  it("grants the Discord owner and Administrator bypass without inventing an action mapping", async () => {
    const makeTransport = (ownerId: string, permissions: string): DiscordRestTransport => ({
      async request<T>(_method, route) {
        if (route.endsWith("/roles")) return [
          { id: "123456789012345678", permissions: "0" },
          { id: "222222222222222222", permissions },
        ] as T;
        if (route.endsWith("/members/444444444444444444")) return {
          user: { id: "444444444444444444" }, roles: ["222222222222222222"],
        } as T;
        return { id: "123456789012345678", owner_id: ownerId } as T;
      },
    });
    const administrator = await fetchLiveDiscordPermissionSnapshot(new DiscordRestService(makeTransport("999999999999999999", "8")), {
      guildId: "123456789012345678", actorDiscordUserId: "444444444444444444",
    });
    expect(administrator.isAdministrator).toBe(true);
    expect(hasLiveDiscordPermission(administrator, 1n << 40n)).toBe(true);

    const owner = await fetchLiveDiscordPermissionSnapshot(new DiscordRestService(makeTransport("444444444444444444", "0")), {
      guildId: "123456789012345678", actorDiscordUserId: "444444444444444444",
    });
    expect(owner.isGuildOwner).toBe(true);
    expect(hasLiveDiscordPermission(owner, 1n << 40n)).toBe(true);
  });

  it("fails closed on malformed live role data and invalid IDs", async () => {
    const malformed: DiscordRestTransport = {
      async request<T>(_method, route) {
        if (route.endsWith("/roles")) return [{ id: "222222222222222222", permissions: "not-a-bitfield" }] as T;
        if (route.includes("/members/")) return { user: { id: "444444444444444444" }, roles: [] } as T;
        return { id: "123456789012345678", owner_id: "999999999999999999" } as T;
      },
    };
    await expect(fetchLiveDiscordPermissionSnapshot(new DiscordRestService(malformed), {
      guildId: "123456789012345678", actorDiscordUserId: "444444444444444444",
    })).rejects.toMatchObject({ code: "DISCORD_API_ERROR" });
    await expect(fetchLiveDiscordPermissionSnapshot(new DiscordRestService(malformed), {
      guildId: "not-a-guild", actorDiscordUserId: "444444444444444444",
    })).rejects.toThrow(/Discord snowflakes/);
    expect(() => hasLiveDiscordPermission({
      guildId: "1", actorDiscordUserId: "2", guildOwnerDiscordUserId: "3",
      roleIds: [], permissionBits: 0n, isGuildOwner: false, isAdministrator: false,
    }, 0n)).toThrow(/must be positive/);
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
