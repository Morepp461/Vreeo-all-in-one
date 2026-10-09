import { describe, expect, it, vi } from "vitest";
import type { DatabaseClient } from "@vreeo/database";
import { PrismaGuildAccessRepository } from "./prisma-guild-access-repository.js";

const moderator = {
  id: "internal-guild-1",
  discordGuildId: "222222222222222222",
  name: "Example Guild",
  iconUrl: "",
  ownerDiscordUserId: "999999999999999999",
  active: true,
  botJoinedAt: new Date("2026-01-01T00:00:00Z"),
  members: [{ roles: [{ discordRoleId: "role-moderator" }] }],
  roles: [{ discordRoleId: "role-moderator", permissions: "32" }],
};
function repositoryFor(guild: typeof moderator | null) {
  const prisma = {
    guild: {
      findUnique: vi.fn(async () => guild),
      findMany: vi.fn(async () => guild ? [guild] : []),
    },
  } as unknown as DatabaseClient;
  return { repository: new PrismaGuildAccessRepository(prisma), prisma };
}

describe("Prisma guild access policy", () => {
  it("resolves context from active bot registry and current member role permissions", async () => {
    const { repository, prisma } = repositoryFor(moderator);
    const result = await repository.resolveGuildContext(moderator.discordGuildId, "123456789012345678");
    expect(result).toEqual({
      status: "ok",
      guild: {
        guildId: moderator.id,
        discordGuildId: moderator.discordGuildId,
        name: moderator.name,
        iconUrl: moderator.iconUrl,
        isOwner: false,
        roleIds: ["role-moderator"],
      },
    });
    expect(prisma.guild.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { discordGuildId: moderator.discordGuildId },
    }));
  });

  it("fails closed for a member without Manage Server or Administrator", async () => {
    const { repository } = repositoryFor({
      ...moderator,
      roles: [{ discordRoleId: "role-moderator", permissions: "1048576" }],
    });
    expect(await repository.resolveGuildContext(moderator.discordGuildId, "123456789012345678")).toEqual({ status: "forbidden" });
  });

  it("allows the guild owner even when no member-role snapshot exists", async () => {
    const { repository } = repositoryFor({ ...moderator, members: [] });
    expect(await repository.resolveGuildContext(moderator.discordGuildId, moderator.ownerDiscordUserId)).toMatchObject({
      status: "ok",
      guild: { isOwner: true, roleIds: [] },
    });
  });

  it("rejects inactive guilds and guilds without an active bot registry record", async () => {
    const { repository: inactive } = repositoryFor({ ...moderator, active: false });
    expect(await inactive.resolveGuildContext(moderator.discordGuildId, moderator.ownerDiscordUserId)).toEqual({ status: "not_found" });
    const { repository: botLeft } = repositoryFor({ ...moderator, botJoinedAt: null });
    expect(await botLeft.resolveGuildContext(moderator.discordGuildId, moderator.ownerDiscordUserId)).toEqual({ status: "not_found" });
  });

  it("lists only owners or members whose assigned roles grant a required Discord permission", async () => {
    const normalMember = {
      ...moderator,
      id: "internal-guild-2",
      discordGuildId: "333333333333333333",
      name: "Normal Member Guild",
      roles: [{ discordRoleId: "role-member", permissions: "1048576" }],
      members: [{ roles: [{ discordRoleId: "role-member" }] }],
    };
    const ownerGuild = {
      ...moderator,
      id: "internal-guild-3",
      discordGuildId: "444444444444444444",
      name: "Owner Guild",
      ownerDiscordUserId: "123456789012345678",
      members: [],
    };
    const prisma = {
      guild: { findMany: vi.fn(async () => [moderator, normalMember, ownerGuild]) },
    } as unknown as DatabaseClient;
    const repository = new PrismaGuildAccessRepository(prisma);
    const result = await repository.listManageableGuilds("123456789012345678");
    expect(result.map((guild) => guild.discordGuildId)).toEqual([moderator.discordGuildId, ownerGuild.discordGuildId]);
    expect(result[0]?.accessLevel).toBe("manage_guild");
    expect(result[1]?.accessLevel).toBe("owner");
  });
});
