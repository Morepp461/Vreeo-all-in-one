import { describe, expect, it } from "vitest";
import { buildEventIdempotencyKey, createInternalEvent, isInternalDomainEvent } from "./index.js";

describe("internal event contract", () => {
  it("creates events with IDs, timestamps, and documented identity fields", () => {
    const event = createInternalEvent({ event: "member.joined", guildId: "internal-guild-1", userId: "internal-user-1", discordGuildId: "123", discordUserId: "456", metadata: { source: "gateway" } });
    expect(event.eventId).toBeTruthy();
    expect(Number.isFinite(Date.parse(event.timestamp))).toBe(true);
    expect(event).toMatchObject({ event: "member.joined", guildId: "internal-guild-1", userId: "internal-user-1", discordGuildId: "123", discordUserId: "456", metadata: { source: "gateway" } });
    expect(isInternalDomainEvent(event)).toBe(true);
  });
  it("rejects malformed event names, IDs, timestamps, and metadata", () => {
    expect(() => createInternalEvent({ event: "Member Joined", metadata: {} })).toThrow(/lowercase dotted/);
    expect(() => createInternalEvent({ event: "member.joined", eventId: " ", metadata: {} })).toThrow(/ID/);
    expect(() => createInternalEvent({ event: "member.joined", timestamp: "not-a-date", metadata: {} })).toThrow(/timestamp/);
    expect(isInternalDomainEvent({ eventId: "e1", event: "member.joined", timestamp: "2026-01-01", metadata: [] })).toBe(false);
  });
  it("derives a stable idempotency key from event type and ID", () => {
    const event = createInternalEvent({ event: "moderation.case.created", eventId: "event-123", metadata: {} });
    expect(buildEventIdempotencyKey(event)).toBe("moderation.case.created:event-123");
  });
});
