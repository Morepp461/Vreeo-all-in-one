import { describe, expect, it } from "vitest";
import {
  FEATURE_KEYS,
  INTERNAL_ADMIN_PERMISSION_KEYS,
  PERMISSION_KEYS,
  isFeatureKey,
  isInternalAdminPermissionKey,
  isPermissionKey,
} from "./index.js";

describe("shared identifiers", () => {
  it("keeps permission keys unique and exposes the warn permission", () => {
    expect(new Set(PERMISSION_KEYS).size).toBe(PERMISSION_KEYS.length);
    expect(isPermissionKey("moderation.warn")).toBe(true);
    expect(isPermissionKey("moderation.not_a_real_action")).toBe(false);
  });

  it("keeps internal admin permissions separate from guild permissions", () => {
    expect(isInternalAdminPermissionKey("admin.users.read")).toBe(true);
    expect(isPermissionKey("admin.users.read")).toBe(false);
    expect(INTERNAL_ADMIN_PERMISSION_KEYS.length).toBeGreaterThan(0);
  });

  it("exposes stable feature keys without assigning plan tiers in code", () => {
    expect(new Set(FEATURE_KEYS).size).toBe(FEATURE_KEYS.length);
    expect(isFeatureKey("basic_moderation")).toBe(true);
    expect(isFeatureKey("made_up_feature")).toBe(false);
  });
});
