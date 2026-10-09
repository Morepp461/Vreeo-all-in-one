import { describe, expect, it, vi } from "vitest";
import { DiscordOAuthHttpProvider, DiscordOAuthProviderError } from "./discord-oauth-provider.js";

const config = { clientId: "client-id", clientSecret: "client-secret", redirectUri: "http://localhost:3001/api/v1/auth/discord/callback" };

describe("Discord OAuth HTTP provider", () => {
  it("requests guilds scope and validates guild discovery payloads", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify([
      { id: "123456789012345678", name: "Community", icon: null, owner: true, permissions: "0" },
    ]), { status: 200, headers: { "content-type": "application/json" } }));
    const provider = new DiscordOAuthHttpProvider(config, fetchImpl);
    await expect(provider.fetchGuilds("temporary-access-token")).resolves.toEqual([
      { id: "123456789012345678", name: "Community", icon: null, owner: true, permissions: "0" },
    ]);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe("https://discord.com/api/v10/users/@me/guilds?limit=200");
    expect(new URL(provider.buildAuthorizationUrl("state")).searchParams.get("scope")).toBe("identify guilds");
  });

  it("rejects malformed guild data and non-success responses", async () => {
    const malformed = new DiscordOAuthHttpProvider(config, vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify([
      { id: "bad", name: "Bad", icon: null, owner: false, permissions: "32" },
    ]), { status: 200 })));
    await expect(malformed.fetchGuilds("token")).rejects.toMatchObject({ stage: "GUILD_DISCOVERY" });
    const unavailable = new DiscordOAuthHttpProvider(config, vi.fn<typeof fetch>().mockResolvedValue(new Response("{}", { status: 403 })));
    await expect(unavailable.fetchGuilds("token")).rejects.toBeInstanceOf(DiscordOAuthProviderError);
  });
});
