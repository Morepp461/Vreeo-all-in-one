# Entitlements package

Pure entitlement resolution helpers and stable feature identifiers.

- Feature keys and plan keys follow the Permission & Entitlement Specification.
- Plan-to-feature mappings are not hardcoded; the source assigns final tier mappings to the Master Feature Map and expects plan data to be database-driven.
- The resolver requires explicit source precedence because the specification does not settle precedence across all manual grants, promotions, trials, and internal overrides.
- Expired candidates are ignored. Subscription state handling fails closed for `past_due` and unspecified state; `grace` requires an explicit policy; cancelled-at-period-end access ends at the configured period end.
- Always check `hasFeature` separately from `hasLimit`; a null limit is not proof of entitlement.
