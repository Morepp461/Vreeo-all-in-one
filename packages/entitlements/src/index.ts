import type { EntitlementSource, FeatureKey, SubscriptionState } from "@vreeo/types";

export interface EntitlementCandidate {
  featureKey: FeatureKey;
  source: EntitlementSource;
  enabled: boolean;
  /** null means no numeric limit is configured for this candidate. */
  limit: number | null;
  expiresAt: Date | null;
  /** Required for subscription-sourced candidates; unknown states fail closed. */
  subscriptionState?: SubscriptionState;
  /** Used only for the documented cancelled-at-period-end behavior. */
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: Date | null;
  /** Grace access is policy-defined in the source specification and must be explicit. */
  graceAccessAllowed?: boolean;
}

export interface ResolvedEntitlement {
  featureKey: FeatureKey;
  enabled: boolean;
  limit: number | null;
  source: EntitlementSource | null;
  expiresAt: Date | null;
}

export interface ResolveEntitlementOptions {
  /** Highest-precedence source first. Callers must provide an explicit policy. */
  precedence: readonly EntitlementSource[];
  now?: Date;
}

function isCandidateActive(candidate: EntitlementCandidate, now: Date): boolean {
  if (candidate.expiresAt && candidate.expiresAt.getTime() <= now.getTime()) return false;
  if (candidate.source !== "subscription") return true;

  switch (candidate.subscriptionState) {
    case "active":
    case "trialing":
      return true;
    case "grace":
      return candidate.graceAccessAllowed === true;
    case "cancelled":
      return candidate.cancelAtPeriodEnd === true &&
        candidate.currentPeriodEnd instanceof Date &&
        candidate.currentPeriodEnd.getTime() > now.getTime();
    case "past_due":
    case "expired":
    case undefined:
    default:
      return false;
  }
}

/**
 * Resolves already-loaded entitlement candidates. Storage/plan mappings remain
 * data-driven; the caller must supply source precedence because the specification
 * does not define precedence between every possible manual/promotion override.
 */
export function resolveEntitlement(
  featureKey: FeatureKey,
  candidates: readonly EntitlementCandidate[],
  options: ResolveEntitlementOptions,
): ResolvedEntitlement {
  const now = options.now ?? new Date();
  const precedence = new Map<EntitlementSource, number>();
  options.precedence.forEach((source, index) => {
    if (precedence.has(source)) throw new Error(`Duplicate entitlement precedence source: ${source}`);
    precedence.set(source, index);
  });

  const relevant = candidates.filter((candidate) => candidate.featureKey === featureKey);
  for (const candidate of relevant) {
    if (!precedence.has(candidate.source)) {
      throw new Error(`Entitlement source missing from precedence policy: ${candidate.source}`);
    }
    if (candidate.limit !== null && (!Number.isSafeInteger(candidate.limit) || candidate.limit < 0)) {
      throw new Error("Entitlement limit must be a non-negative safe integer or null");
    }
  }

  const bySource = new Map<EntitlementSource, EntitlementCandidate>();
  for (const candidate of relevant) {
    if (bySource.has(candidate.source)) {
      throw new Error(`Only one effective candidate per entitlement source is allowed: ${candidate.source}`);
    }
    bySource.set(candidate.source, candidate);
  }

  const ordered = relevant
    .filter((candidate) => isCandidateActive(candidate, now))
    .sort((left, right) => (precedence.get(left.source) ?? Number.MAX_SAFE_INTEGER) -
      (precedence.get(right.source) ?? Number.MAX_SAFE_INTEGER));
  const selected = ordered[0];
  if (!selected) {
    return { featureKey, enabled: false, limit: null, source: null, expiresAt: null };
  }
  return {
    featureKey,
    enabled: selected.enabled,
    limit: selected.limit,
    source: selected.source,
    expiresAt: selected.expiresAt,
  };
}

export function hasFeature(entitlement: ResolvedEntitlement, now = new Date()): boolean {
  return entitlement.enabled && (entitlement.expiresAt === null || entitlement.expiresAt.getTime() > now.getTime());
}

/**
 * Returns the configured limit. Callers must check hasFeature separately;
 * null means no numeric limit is configured, not proof of entitlement.
 */
export function hasLimit(entitlement: ResolvedEntitlement, now = new Date()): number | null {
  return hasFeature(entitlement, now) ? entitlement.limit : null;
}
