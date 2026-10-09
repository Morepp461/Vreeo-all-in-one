import type { DatabaseClient } from "@vreeo/database";
import { evaluatePermission, type DiscordPermissionContext } from "@vreeo/permissions";
import {
  isPermissionKey,
  type AuthorizationResult,
  type PermissionKey,
  type PermissionOverride,
  type RolePermissionGrant,
} from "@vreeo/types";
import type { VreeoGuildContext } from "./context.js";

export interface GuildPermissionPolicy {
  roleGrants: RolePermissionGrant[];
  overrides: PermissionOverride[];
  /** Empty until an explicit profile/assignment schema exists; this is intentionally fail-closed. */
  defaultPermissions: PermissionKey[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function permissionSet(value: unknown): Readonly<Record<string, unknown>> {
  return isRecord(value) ? value : {};
}

export async function loadGuildPermissionPolicy(
  database: DatabaseClient,
  context: VreeoGuildContext,
  permission: string,
): Promise<GuildPermissionPolicy> {
  if (!isPermissionKey(permission)) {
    return { roleGrants: [], overrides: [], defaultPermissions: [] };
  }
  const roleIds = [...new Set(context.roleIds)];
  const [roleRows, overrideRows] = await Promise.all([
    roleIds.length === 0
      ? Promise.resolve([])
      : database.permissionRole.findMany({
          where: { guildId: context.guildId, discordRoleId: { in: roleIds } },
          select: { discordRoleId: true, permissionSet: true },
        }),
    database.permissionOverride.findMany({
      where: { guildId: context.guildId, permissionKey: permission },
      select: { subjectType: true, subjectDiscordId: true, permissionKey: true, effect: true },
    }),
  ]);

  const roleGrants: RolePermissionGrant[] = roleRows.map((row) => ({
    guildId: context.guildId,
    discordRoleId: row.discordRoleId,
    permissionSet: permissionSet(row.permissionSet),
  }));
  const assignedRoles = new Set(roleIds);
  const overrides: PermissionOverride[] = [];
  for (const row of overrideRows) {
    if (!isPermissionKey(row.permissionKey)) continue;
    if (row.subjectType !== "user" && row.subjectType !== "role") continue;
    if (row.effect !== "allow" && row.effect !== "deny") continue;
    if (row.subjectType === "user" && row.subjectDiscordId !== context.discordUserId) continue;
    if (row.subjectType === "role" && !assignedRoles.has(row.subjectDiscordId)) continue;
    overrides.push({
      subjectType: row.subjectType,
      subjectId: row.subjectDiscordId,
      permission: row.permissionKey,
      effect: row.effect,
    });
  }

  return { roleGrants, overrides, defaultPermissions: [] };
}

export async function authorizeGuildAction(
  database: DatabaseClient,
  context: VreeoGuildContext,
  permission: string,
  discord?: DiscordPermissionContext,
): Promise<AuthorizationResult> {
  const policy = await loadGuildPermissionPolicy(database, context, permission);
  return evaluatePermission({
    authenticated: true,
    requestedGuildId: context.guildId,
    guildAccess: true,
    actor: {
      actorType: "user",
      userId: context.userId,
      discordUserId: context.discordUserId,
      guildId: context.guildId,
      roleIds: context.roleIds,
    },
    permission,
    overrides: policy.overrides,
    roleGrants: policy.roleGrants,
    defaultPermissions: policy.defaultPermissions,
    ...(discord ? { discord } : {}),
  });
}

function denialCode(result: AuthorizationResult): string {
  if (result.reasons.includes("MISSING_DISCORD_PERMISSION")) return "DISCORD_PERMISSION_REQUIRED";
  if (result.reasons.includes("MISSING_VREEO_PERMISSION")) return "VREEO_PERMISSION_DENIED";
  if (result.reasons.includes("GUILD_ACCESS_DENIED")) return "GUILD_ACCESS_DENIED";
  return "PERMISSION_DENIED";
}

/** Compose after requireGuildContext in a route's preHandler array. Entitlements remain a separate gate. */
export function requireGuildPermission(database: DatabaseClient, permission: string) {
  return async (request: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply): Promise<void | import("fastify").FastifyReply> => {
    const context = request.vreeoGuildContext;
    if (!context) {
      return reply.code(500).header("Cache-Control", "no-store").send({
        error: { code: "INTERNAL_ERROR", message: "Guild context was not initialized.", requestId: request.id },
      });
    }
    const result = await authorizeGuildAction(database, context, permission);
    if (result.allowed) return;
    return reply.code(403).header("Cache-Control", "no-store").send({
      error: { code: denialCode(result), message: "You do not have permission to perform this action.", requestId: request.id },
    });
  };
}
