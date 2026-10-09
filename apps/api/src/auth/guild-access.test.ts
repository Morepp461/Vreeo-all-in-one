import { describe, expect, it } from "vitest";
import { canManageDiscordGuild } from "./guild-access.js";

describe("Discord guild access policy", () => {
  it("allows owners and users with Administrator or Manage Server", () => {
    expect(canManageDiscordGuild({ id: "1", name: "owner", icon: null, owner: true, permissions: "0" })).toBe(true);
    expect(canManageDiscordGuild({ id: "2", name: "admin", icon: null, owner: false, permissions: "8" })).toBe(true);
    expect(canManageDiscordGuild({ id: "3", name: "manager", icon: null, owner: false, permissions: "32" })).toBe(true);
  });
  it("rejects unrelated permissions and malformed bitfields", () => {
    expect(canManageDiscordGuild({ id: "4", name: "member", icon: null, owner: false, permissions: "2048" })).toBe(false);
    expect(canManageDiscordGuild({ id: "5", name: "invalid", icon: null, owner: false, permissions: "8x" })).toBe(false);
  });
});
