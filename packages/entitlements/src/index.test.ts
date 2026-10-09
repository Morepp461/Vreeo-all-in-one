import { describe, expect, it } from "vitest";
import type { EntitlementSource, FeatureKey } from "@vreeo/types";
import { hasFeature, hasLimit, resolveEntitlement, type EntitlementCandidate } from "./index.js";

const feature: FeatureKey = "advanced_automod";
const now = new Date("2026-10-09T00:00:00.000Z");
const precedence: readonly EntitlementSource[] = [
  "internal_override", "manual_grant", "subscription", "trial", "promotion", "plan",
];

function candidate(overrides: Partial<EntitlementCandidate> = {}): EntitlementCandidate {
  return {
    featureKey: feature,
    source: "plan",
    enabled: true,
    limit: 5,
    expiresAt: null,
    ...overrides,
  };
}

describe("entitlement resolution", () => {
  it("uses the explicitly supplied source precedence without hardcoding plan tiers", () => {
    const result = resolveEntitlement(feature, [
      candidate({ source: "plan", enabled: true, limit: 5 }),
      candidate({ source: "manual_grant", enabled: false, limit: 0 }),
    ], { precedence, now });
    expect(result).toMatchObject({ enabled: false, limit: 0, source: "manual_grant" });
  });

  it("fails closed when there is no active candidate", () => {
    expect(resolveEntitlement(feature, [], { precedence, now })).toEqual({
      featureKey: feature, enabled: false, limit: null, source: null, expiresAt: null,
    });
    expect(resolveEntitlement(feature, [
      candidate({ source: "subscription", subscriptionState: "past_due" }),
    ], { precedence, now }).enabled).toBe(false);
  });

  it("handles expiry, trialing, grace policy, and cancelled-at-period-end explicitly", () => {
    expect(hasFeature(resolveEntitlement(feature, [
      candidate({ expiresAt: new Date(now.getTime() - 1) }),
    ], { precedence, now }), now)).toBe(false);

    expect(resolveEntitlement(feature, [
      candidate({ source: "subscription", subscriptionState: "trialing" }),
    ], { precedence, now }).enabled).toBe(true);

    expect(resolveEntitlement(feature, [
      candidate({ source: "subscription", subscriptionState: "grace", graceAccessAllowed: false }),
    ], { precedence, now }).enabled).toBe(false);

    expect(resolveEntitlement(feature, [
      candidate({
        source: "subscription",
        subscriptionState: "cancelled",
        cancelAtPeriodEnd: true,
        currentPeriodEnd: new Date(now.getTime() + 60_000),
      }),
    ], { precedence, now }).enabled).toBe(true);
  });

  it("returns limits only for an effective entitlement and validates source policy", () => {
    const result = resolveEntitlement(feature, [candidate({ limit: 25 })], { precedence, now });
    expect(hasLimit(result, now)).toBe(25);
    expect(() => resolveEntitlement(feature, [candidate()], { precedence: ["subscription"], now }))
      .toThrow(/missing from precedence/);
    expect(() => resolveEntitlement(feature, [
      candidate({ limit: -1 }),
    ], { precedence, now })).toThrow(/non-negative/);
  });
});
