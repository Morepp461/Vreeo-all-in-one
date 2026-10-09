import { REST } from "discord.js";
import type { Logger } from "pino";

export type DiscordRestMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type DiscordApiRoute = `/${string}`;
export type DiscordServiceErrorCode = "DISCORD_PERMISSION_MISSING" | "DISCORD_HIERARCHY_BLOCKED" | "DISCORD_RESOURCE_NOT_FOUND" | "DISCORD_RATE_LIMITED" | "DISCORD_API_ERROR";

export class DiscordServiceError extends Error {
  readonly code: DiscordServiceErrorCode;
  readonly statusCode?: number;
  constructor(code: DiscordServiceErrorCode, message: string, options: { statusCode?: number; cause?: unknown } = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : {});
    this.name = "DiscordServiceError";
    this.code = code;
    if (options.statusCode !== undefined) this.statusCode = options.statusCode;
  }
}
export interface DiscordRestTransport { request<T>(method: DiscordRestMethod, route: DiscordApiRoute, options?: unknown): Promise<T>; }
export interface DiscordRequestContext { operation: string; guildId?: string; correlationId?: string; }
export interface DiscordRequestMetric { method: DiscordRestMethod; operation: string; durationMs: number; success: boolean; statusCode?: number; }
export interface DiscordRestServiceOptions { logger?: Pick<Logger, "info" | "warn">; onRequestMetric?: (metric: DiscordRequestMetric) => void; }
export interface DiscordRestRequest { method: DiscordRestMethod; route: DiscordApiRoute; options?: unknown; context: DiscordRequestContext; }

interface ErrorLike { status?: unknown; statusCode?: unknown; code?: unknown; rawError?: { code?: unknown }; }
function errorStatus(error: ErrorLike): number | undefined {
  if (typeof error.statusCode === "number") return error.statusCode;
  if (typeof error.status === "number") return error.status;
  return undefined;
}
export function normalizeDiscordError(error: unknown): DiscordServiceError {
  if (error instanceof DiscordServiceError) return error;
  const candidate = typeof error === "object" && error !== null ? error as ErrorLike : {};
  const statusCode = errorStatus(candidate);
  const discordCode = typeof candidate.code === "number" ? candidate.code : typeof candidate.rawError?.code === "number" ? candidate.rawError.code : undefined;
  let code: DiscordServiceErrorCode = "DISCORD_API_ERROR";
  if (statusCode === 429) code = "DISCORD_RATE_LIMITED";
  else if (statusCode === 404) code = "DISCORD_RESOURCE_NOT_FOUND";
  else if (statusCode === 403 || discordCode === 50013) code = "DISCORD_PERMISSION_MISSING";
  return new DiscordServiceError(code, "Discord request failed.", { ...(statusCode !== undefined ? { statusCode } : {}), cause: error });
}

/** discord.js REST owns rate-limit scheduling; this wrapper adds safe logs, metrics, and normalized errors. */
export class DiscordRestService {
  constructor(private readonly transport: DiscordRestTransport, private readonly options: DiscordRestServiceOptions = {}) {}
  async request<T>(request: DiscordRestRequest): Promise<T> {
    const startedAt = Date.now();
    try {
      const result = await this.transport.request<T>(request.method, request.route, request.options);
      this.options.logger?.info({ operation: request.context.operation, guildId: request.context.guildId, correlationId: request.context.correlationId, method: request.method, durationMs: Date.now() - startedAt }, "Discord REST request completed");
      this.recordMetric({ method: request.method, operation: request.context.operation, durationMs: Date.now() - startedAt, success: true });
      return result;
    } catch (error) {
      const normalized = normalizeDiscordError(error);
      this.options.logger?.warn({ operation: request.context.operation, guildId: request.context.guildId, correlationId: request.context.correlationId, method: request.method, code: normalized.code, statusCode: normalized.statusCode, durationMs: Date.now() - startedAt }, "Discord REST request failed");
      this.recordMetric({ method: request.method, operation: request.context.operation, durationMs: Date.now() - startedAt, success: false, ...(normalized.statusCode !== undefined ? { statusCode: normalized.statusCode } : {}) });
      throw normalized;
    }
  }
  private recordMetric(metric: DiscordRequestMetric): void {
    try { this.options.onRequestMetric?.(metric); } catch { /* telemetry must not change the operation result */ }
  }
}
export function createDiscordRestTransport(token: string): DiscordRestTransport {
  if (token.trim().length === 0) throw new Error("Discord token must be non-empty");
  const rest = new REST({ version: "10" }).setToken(token);
  return { async request<T>(method: DiscordRestMethod, route: DiscordApiRoute, options?: unknown): Promise<T> {
    switch (method) {
      case "GET": return await rest.get(route, options as never) as T;
      case "POST": return await rest.post(route, options as never) as T;
      case "PUT": return await rest.put(route, options as never) as T;
      case "PATCH": return await rest.patch(route, options as never) as T;
      case "DELETE": return await rest.delete(route, options as never) as T;
    }
  } };
}
export interface BotHierarchyInput { botHighestRolePosition: number; targetHighestRolePosition: number; targetRoleManaged: boolean; }
export function assertBotHierarchy(input: BotHierarchyInput): void {
  if (!Number.isSafeInteger(input.botHighestRolePosition) || !Number.isSafeInteger(input.targetHighestRolePosition) || input.botHighestRolePosition < 0 || input.targetHighestRolePosition < 0) {
    throw new TypeError("Discord role positions must be non-negative safe integers");
  }
  if (input.targetRoleManaged || input.botHighestRolePosition <= input.targetHighestRolePosition) {
    throw new DiscordServiceError("DISCORD_HIERARCHY_BLOCKED", "The bot cannot act on the target due to Discord role hierarchy.");
  }
}
export function assertDiscordPermissions(requiredPermissions: readonly string[], grantedPermissions: readonly string[]): void {
  const granted = new Set(grantedPermissions);
  if (requiredPermissions.some((permission) => !granted.has(permission))) throw new DiscordServiceError("DISCORD_PERMISSION_MISSING", "The bot lacks a required Discord permission.");
}


export interface LiveDiscordPermissionSnapshot {
  guildId: string;
  actorDiscordUserId: string;
  guildOwnerDiscordUserId: string;
  roleIds: readonly string[];
  /** Decimal Discord permission bitfield computed from the live member roles. */
  permissionBits: bigint;
  isGuildOwner: boolean;
  isAdministrator: boolean;
}

interface LiveDiscordGuildPayload { id: string; owner_id: string; }
interface LiveDiscordRolePayload { id: string; permissions: string; }
interface LiveDiscordMemberPayload { user: { id: string }; roles: string[]; }

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSnowflake(value: unknown): value is string {
  return typeof value === "string" && /^\d{1,32}$/.test(value);
}

function parseLiveGuildPayload(value: unknown, requestedGuildId: string): LiveDiscordGuildPayload {
  if (!isRecordLike(value) || value.id !== requestedGuildId || !isSnowflake(value.owner_id)) {
    throw new DiscordServiceError("DISCORD_API_ERROR", "Discord returned an invalid guild authorization response.");
  }
  return { id: value.id as string, owner_id: value.owner_id };
}

function parseLiveRolePayloads(value: unknown): LiveDiscordRolePayload[] {
  if (!Array.isArray(value)) throw new DiscordServiceError("DISCORD_API_ERROR", "Discord returned an invalid role authorization response.");
  return value.map((item) => {
    if (!isRecordLike(item) || !isSnowflake(item.id) ||
      typeof item.permissions !== "string" || !/^\d+$/.test(item.permissions)) {
      throw new DiscordServiceError("DISCORD_API_ERROR", "Discord returned an invalid role authorization response.");
    }
    try { BigInt(item.permissions); } catch {
      throw new DiscordServiceError("DISCORD_API_ERROR", "Discord returned an invalid role permission bitfield.");
    }
    return { id: item.id, permissions: item.permissions };
  });
}

function parseLiveMemberPayload(value: unknown, requestedActorId: string): LiveDiscordMemberPayload {
  if (!isRecordLike(value) || !isRecordLike(value.user) || value.user.id !== requestedActorId ||
    !Array.isArray(value.roles) || !value.roles.every(isSnowflake)) {
    throw new DiscordServiceError("DISCORD_API_ERROR", "Discord returned an invalid member authorization response.");
  }
  return { user: { id: value.user.id as string }, roles: value.roles as string[] };
}

/**
 * Fetches current membership and role permissions from Discord instead of trusting
 * the login-time OAuth permission snapshot. Callers must still supply the
 * action-specific required permission bit; this helper intentionally invents no
 * VREEO-to-Discord permission mapping.
 */
export async function fetchLiveDiscordPermissionSnapshot(
  service: DiscordRestService,
  input: { guildId: string; actorDiscordUserId: string; correlationId?: string },
): Promise<LiveDiscordPermissionSnapshot> {
  if (!isSnowflake(input.guildId) || !isSnowflake(input.actorDiscordUserId)) {
    throw new TypeError("Guild and actor IDs must be Discord snowflakes");
  }
  const context = { guildId: input.guildId, ...(input.correlationId ? { correlationId: input.correlationId } : {}) };
  const [guildPayload, rolesPayload, memberPayload] = await Promise.all([
    service.request<unknown>({ method: "GET", route: `/guilds/${input.guildId}`, context: { ...context, operation: "authorization.guild.fetch" } }),
    service.request<unknown>({ method: "GET", route: `/guilds/${input.guildId}/roles`, context: { ...context, operation: "authorization.roles.fetch" } }),
    service.request<unknown>({ method: "GET", route: `/guilds/${input.guildId}/members/${input.actorDiscordUserId}`, context: { ...context, operation: "authorization.member.fetch" } }),
  ]);
  const guild = parseLiveGuildPayload(guildPayload, input.guildId);
  const roles = parseLiveRolePayloads(rolesPayload);
  const member = parseLiveMemberPayload(memberPayload, input.actorDiscordUserId);
  const rolesById = new Map(roles.map((role) => [role.id, role]));
  const assignedRoleIds = [...new Set([input.guildId, ...member.roles])];
  if (assignedRoleIds.some((roleId) => !rolesById.has(roleId))) {
    throw new DiscordServiceError("DISCORD_API_ERROR", "Discord returned a member role that is not present in the guild role list.");
  }
  let permissionBits = 0n;
  for (const roleId of assignedRoleIds) permissionBits |= BigInt(rolesById.get(roleId)!.permissions);
  const isGuildOwner = guild.owner_id === input.actorDiscordUserId;
  const isAdministrator = (permissionBits & 8n) === 8n;
  return {
    guildId: guild.id,
    actorDiscordUserId: member.user.id,
    guildOwnerDiscordUserId: guild.owner_id,
    roleIds: member.roles,
    permissionBits,
    isGuildOwner,
    isAdministrator,
  };
}

/** requiredPermissionBits must come from an explicitly approved action mapping. */
export function hasLiveDiscordPermission(
  snapshot: LiveDiscordPermissionSnapshot,
  requiredPermissionBits: bigint,
): boolean {
  if (requiredPermissionBits <= 0n) throw new TypeError("Required Discord permission bits must be positive");
  if (snapshot.isGuildOwner || snapshot.isAdministrator) return true;
  return (snapshot.permissionBits & requiredPermissionBits) === requiredPermissionBits;
}
