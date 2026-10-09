import { describe, expect, it } from "vitest";
import { API_ERROR_CODES, FEATURE_KEYS, PERMISSION_KEYS, PLAN_KEYS } from "./index.js";

describe("shared domain identifiers", () => {
  it("keeps permission and feature keys unique and stable", () => {
    expect(new Set(PERMISSION_KEYS).size).toBe(PERMISSION_KEYS.length);
    expect(new Set(FEATURE_KEYS).size).toBe(FEATURE_KEYS.length);
    expect(PERMISSION_KEYS).toContain("moderation.warn");
    expect(FEATURE_KEYS).toContain("advanced_automod");
  });

  it("exposes only the documented plan identifiers and API error codes", () => {
    expect(PLAN_KEYS).toEqual(["free", "premium", "premium_plus"]);
    expect(API_ERROR_CODES).toContain("FEATURE_NOT_ENTITLED");
    expect(API_ERROR_CODES).toContain("IDEMPOTENCY_CONFLICT");
  });
});
