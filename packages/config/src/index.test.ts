import { describe, expect, it } from "vitest";
import { loadApiConfig, loadBotConfig } from "./index.js";

const localApiEnvironment = {
  DATABASE_URL: "postgresql://vreeo:vreeo_dev_only@localhost:5432/vreeo?schema=public",
  REDIS_URL: "redis://127.0.0.1:6379",
};

describe("environment configuration", () => {
  it("applies safe local API defaults", () => {
    const config = loadApiConfig(localApiEnvironment);
    expect(config.apiPort).toBe(3001);
    expect(config.apiHost).toBe("127.0.0.1");
    expect(config.redisUrl).toBe("redis://127.0.0.1:6379");
    expect(config.databaseUrl).toContain("postgresql://");
  });

  it("rejects invalid ports and non-matching dependency URL schemes", () => {
    expect(() => loadApiConfig({ ...localApiEnvironment, API_PORT: "70000" })).toThrow(/API_PORT/);
    expect(() => loadApiConfig({ ...localApiEnvironment, REDIS_URL: "https://redis.example" })).toThrow(/REDIS_URL/);
    expect(() => loadApiConfig({ ...localApiEnvironment, DATABASE_URL: "https://db.example" })).toThrow(/DATABASE_URL/);
  });

  it("requires explicit database and Redis URLs in production", () => {
    expect(() => loadApiConfig({ NODE_ENV: "production" })).toThrow(/DATABASE_URL.*REDIS_URL|REDIS_URL.*DATABASE_URL/);
    expect(() => loadApiConfig({
      NODE_ENV: "production",
      DATABASE_URL: localApiEnvironment.DATABASE_URL,
      REDIS_URL: localApiEnvironment.REDIS_URL,
    })).not.toThrow();
  });

  it("requires a non-empty bot token", () => {
    expect(() => loadBotConfig({ DISCORD_TOKEN: "" })).toThrow(/DISCORD_TOKEN/);
  });

  it("accepts blank optional Discord application identifiers", () => {
    expect(() => loadBotConfig({
      DISCORD_TOKEN: "test-token",
      DISCORD_CLIENT_ID: "",
      DISCORD_DEV_GUILD_ID: "",
    })).not.toThrow();
  });

  it("allows API-only development without Discord credentials", () => {
    expect(loadApiConfig({ ...localApiEnvironment, NODE_ENV: "test" }).nodeEnv).toBe("test");
  });
});
