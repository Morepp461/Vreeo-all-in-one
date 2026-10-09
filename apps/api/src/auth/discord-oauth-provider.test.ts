import { afterEach, describe, expect, it, vi } from "vitest";
import { DiscordOAuthHttpProvider, DiscordOAuthProviderError } from "./discord-oauth-provider.js";

const provider = new DiscordOAuthHttpProvider({
  clientId: "client-id",
  clientSecret: "client-secret",
  redirectUri: "http://localhost:3001/api/v1/auth/discord/callback",
});

afterEach(() => vi.unstubAllGlobals());

describe("Discord OAuth guild discovery", () => {
  it("validates and returns Discord guild access records", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify([
      { id: "123456789012345678", name: "Manageable", icon: null, owner: true, permissions: "8" },
      { id: "234567890123456789", name: "Read only", icon: "abcdef0123456789", owner: false, permissions: "1024" },
    ]), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const guilds = await provider.fetchGuilds("temporary-access-token");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://discord.com/api/v10/users/@me/guilds",
      expect.objectContaining({
        headers: { authorization: "Bearer temporary-access-token", accept: "application/json" },
      }),
    );
    expect(guilds).toHaveLength(2);
    expect(guilds[0]).toMatchObject({ owner: true, permissions: "8" });
  });

  it("fails closed on malformed permission values and duplicate guild IDs", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify([
      { id: "123456789012345678", name: "Bad permissions", icon: null, owner: false, permissions: "administrator" },
    ]), { status: 200 })));
    await expect(provider.fetchGuilds("temporary-access-token")).rejects.toBeInstanceOf(DiscordOAuthProviderError);

    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify([
      { id: "123456789012345678", name: "One", icon: null, owner: false, permissions: "0" },
      { id: "123456789012345678", name: "Duplicate", icon: null, owner: false, permissions: "8" },
    ]), { status: 200 })));
    await expect(provider.fetchGuilds("temporary-access-token")).rejects.toMatchObject({ stage: "GUILD_DISCOVERY" });
  });

  it("does not accept non-array or failed Discord responses", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ guilds: [] }), { status: 200 })));
    await expect(provider.fetchGuilds("temporary-access-token")).rejects.toMatchObject({ stage: "GUILD_DISCOVERY" });

    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response("{}", { status: 503 })));
    await expect(provider.fetchGuilds("temporary-access-token")).rejects.toMatchObject({ stage: "GUILD_DISCOVERY" });
  });
});
