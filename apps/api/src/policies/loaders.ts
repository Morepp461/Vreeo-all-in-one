import type { PrismaClient } from "@vreeo/database";
import type { EntitlementCandidate } from "@vreeo/entitlements";
import type { PermissionOverride, PermissionKey, RolePermissionGrant, FeatureKey, EntitlementSource, SubscriptionState } from "@vreeo/types";
import { ENTITLEMENT_SOURCES, SUBSCRIPTION_STATES } from "@vreeo/types";

export interface LoadedPermissionPolicy {
  guildInternalId: string;
  overrides: PermissionOverride[];
  roleGrants: RolePermissionGrant[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function loadPermissionPolicy(
  database: PrismaClient,
  input: { discordGuildId: string; permission: PermissionKey; discordUserId?: string; roleIds: readonly string[] },
): Promise<LoadedPermissionPolicy | null> {
  const guild = await database.guild.findUnique({
    where: { discordGuildId: input.discordGuildId },
    select: { id: true, active: true, botJoinedAt: true },
  });
  if (!guild || !guild.active || guild.botJoinedAt === null) return null;

  const roleIds = [...new Set(input.roleIds)];
  const [roleRows, overrideRows] = await Promise.all([
    roleIds.length === 0 ? Promise.resolve([]) : database.permissionRole.findMany({
      where: { guildId: guild.id, discordRoleId: { in: roleIds } },
      select: { discordRoleId: true, permissionSet: true },
    }),
    database.permissionOverride.findMany({
      where: {
        guildId: guild.id,
        permissionKey: input.permission,
        OR: [
          ...(roleIds.length > 0 ? [{ subjectType: "role", subjectDiscordId: { in: roleIds } }] : []),
          ...(input.discordUserId ? [{ subjectType: "user", subjectDiscordId: input.discordUserId }] : []),
        ],
      },
      select: { subjectType: true, subjectDiscordId: true, permissionKey: true, effect: true },
    }),
  ]);

  const overrides: PermissionOverride[] = overrideRows.map((row) => {
    if ((row.subjectType !== "user" && row.subjectType !== "role") ||
      (row.effect !== "allow" && row.effect !== "deny") || row.permissionKey !== input.permission) {
      throw new Error("Stored permission override contains an invalid policy value");
    }
    return { subjectType: row.subjectType, subjectId: row.subjectDiscordId, permission: input.permission, effect: row.effect };
  });
  const roleGrants: RolePermissionGrant[] = roleRows.map((row) => ({
    guildId: input.discordGuildId,
    discordRoleId: row.discordRoleId,
    permissionSet: isRecord(row.permissionSet) ? row.permissionSet : {},
  }));
  return { guildInternalId: guild.id, overrides, roleGrants };
}

function safeLimit(value: bigint | null): number | null {
  if (value === null) return null;
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new Error("Stored entitlement limit exceeds the safe integer range");
  }
  return Number(value);
}

function sourceOf(value: string): EntitlementSource {
  if (!(ENTITLEMENT_SOURCES as readonly string[]).includes(value)) {
    throw new Error("Stored entitlement contains an unknown source");
  }
  return value as EntitlementSource;
}

function subscriptionStateOf(value: string | undefined): SubscriptionState | undefined {
  return value && (SUBSCRIPTION_STATES as readonly string[]).includes(value) ? value as SubscriptionState : undefined;
}

export async function loadEntitlementCandidates(
  database: PrismaClient,
  input: {
    discordGuildId: string;
    featureKey: FeatureKey;
    now: Date;
    /** Grace access is intentionally explicit because the source policy does not make it universal. */
    graceAccessAllowed: boolean;
  },
): Promise<EntitlementCandidate[]> {
  const guild = await database.guild.findUnique({
    where: { discordGuildId: input.discordGuildId },
    select: { id: true, active: true, botJoinedAt: true },
  });
  if (!guild || !guild.active || guild.botJoinedAt === null) return [];

  const rows = await database.entitlement.findMany({
    where: { guildId: guild.id, featureKey: input.featureKey },
    select: { sourceType: true, sourceId: true, enabled: true, limitValue: true, expiresAt: true },
  });
  const subscriptionIds = [...new Set(rows.filter((row) => row.sourceType === "subscription" && row.sourceId !== null).map((row) => row.sourceId as string))];
  const subscriptions = subscriptionIds.length === 0 ? [] : await database.subscription.findMany({
    where: { guildId: guild.id, id: { in: subscriptionIds } },
    select: { id: true, status: true, cancelAtPeriodEnd: true, currentPeriodEnd: true, graceUntil: true },
  });
  const byId = new Map(subscriptions.map((subscription) => [subscription.id, subscription]));

  return rows.map((row) => {
    const source = sourceOf(row.sourceType);
    const subscription = source === "subscription" && row.sourceId ? byId.get(row.sourceId) : undefined;
    let state = subscriptionStateOf(subscription?.status);
    if (subscription && (state === "active" || state === "trialing") && subscription.currentPeriodEnd <= input.now) state = "expired";
    if (subscription && state === "grace" && !subscription.graceUntil) state = undefined;
    const expiry = state === "grace" && subscription?.graceUntil
      ? (row.expiresAt && row.expiresAt < subscription.graceUntil ? row.expiresAt : subscription.graceUntil)
      : row.expiresAt;
    return {
      featureKey: input.featureKey,
      source,
      enabled: row.enabled,
      limit: safeLimit(row.limitValue),
      expiresAt: expiry,
      ...(source === "subscription" ? {
        subscriptionState: state,
        cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
        currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
        graceAccessAllowed: input.graceAccessAllowed,
      } : {}),
    };
  });
}
