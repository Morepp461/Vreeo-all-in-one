import { randomUUID } from "node:crypto";
import type { DomainEvent } from "@vreeo/types";

export type InternalDomainEvent<TMetadata extends Record<string, unknown> = Record<string, unknown>> = DomainEvent<TMetadata>;
export interface CreateInternalEventInput<TMetadata extends Record<string, unknown>> {
  event: string; metadata: TMetadata; eventId?: string; timestamp?: string;
  guildId?: string; userId?: string; discordGuildId?: string; discordUserId?: string;
}
const eventNamePattern = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/;
function assertEventName(event: string): void {
  if (!eventNamePattern.test(event)) throw new Error("Internal event names must be lowercase dotted identifiers");
}
export function createInternalEvent<TMetadata extends Record<string, unknown>>(input: CreateInternalEventInput<TMetadata>): InternalDomainEvent<TMetadata> {
  assertEventName(input.event);
  const eventId = input.eventId ?? randomUUID();
  if (eventId.trim().length === 0) throw new Error("Internal event ID must be non-empty");
  const timestamp = input.timestamp ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(timestamp))) throw new Error("Internal event timestamp must be a valid date");
  return {
    eventId, event: input.event, timestamp, metadata: input.metadata,
    ...(input.guildId !== undefined ? { guildId: input.guildId } : {}),
    ...(input.userId !== undefined ? { userId: input.userId } : {}),
    ...(input.discordGuildId !== undefined ? { discordGuildId: input.discordGuildId } : {}),
    ...(input.discordUserId !== undefined ? { discordUserId: input.discordUserId } : {}),
  };
}
export function isInternalDomainEvent(value: unknown): value is InternalDomainEvent {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.eventId !== "string" || candidate.eventId.trim().length === 0) return false;
  if (typeof candidate.event !== "string" || !eventNamePattern.test(candidate.event)) return false;
  if (typeof candidate.timestamp !== "string" || !Number.isFinite(Date.parse(candidate.timestamp))) return false;
  if (typeof candidate.metadata !== "object" || candidate.metadata === null || Array.isArray(candidate.metadata)) return false;
  for (const key of ["guildId", "userId", "discordGuildId", "discordUserId"] as const) {
    if (candidate[key] !== undefined && (typeof candidate[key] !== "string" || candidate[key].trim().length === 0)) return false;
  }
  return true;
}
export function buildEventIdempotencyKey(event: Pick<InternalDomainEvent, "event" | "eventId">): string {
  assertEventName(event.event);
  if (event.eventId.trim().length === 0) throw new Error("Internal event ID must be non-empty");
  return `${event.event}:${event.eventId}`;
}
