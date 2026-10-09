# Permissions package

Central, deterministic VREEO permission evaluation.

- Permission identifiers are the stable inventory from the Permission & Entitlement Specification.
- Override precedence is explicit user deny → user allow → role deny → role allow → configured default profile.
- Discord capabilities and bot hierarchy are evaluated before VREEO permission grants.
- Authentication, guild access, feature flags, entitlements, quotas, and action validation remain separate required gates where applicable.
- Default role profiles are configuration inputs, not hardcoded grants; the source defines conceptual profiles but not a complete per-key matrix.
