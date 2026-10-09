import { describe, expect, it } from "vitest";
import { loadApiConfig, loadBotConfig } from "./index.js";

describe("environment configuration", () => {
  it("applies safe local API defaults", () => {
    expect(loadApiConfig({}).apiPort).toBe(3001);
    expect(loadApiConfig({}).apiHost).toBe("127.0.0.1");
  });

  it("rejects invalid API ports", () => {
    expect(() => loadApiConfig({ API_PORT: "70000" })).toThrow(/API_PORT/);
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
    expect(loadApiConfig({ NODE_ENV: "test" }).nodeEnv).toBe("test");
  });
});
