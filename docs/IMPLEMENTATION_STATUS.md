# Implementation Status

## Current stage: shared domain foundations

This branch builds on `feat/redis-queue-foundation`. It is not a production release and has not been merged into `main`.

### Implemented

- pnpm workspace and CI foundation; PostgreSQL migrations and schema-drift verification.
- Fastify API and Discord gateway process skeletons.
- Redis cache/cooldown/lock/readiness primitives, BullMQ queue/worker policy, payload-free dead-letter records, and TTL-backed idempotent enqueue.
- Provider-neutral object-storage interface.
- Shared domain identifiers for permission keys, feature keys, plan keys, subscription states, API error codes, authorization reasons, and internal event envelope types.
- Central permission evaluation with deterministic override precedence, Discord capability/hierarchy gates, server-resolved guild-context isolation, and server-loaded role permission sets.
- Entitlement resolution with explicit source precedence, expiry handling, subscription-state checks, and no hardcoded plan-to-feature mapping.
- Discord REST service boundary with normalized errors and bot role-hierarchy/permission guards.
- Internal event envelope creation/validation based on the source event contract.

### Important constraints

- Default role profiles are conceptual presets in the source; a complete per-permission matrix is not specified. The permissions package accepts profile permissions from policy/configuration rather than inventing grants.
- Plan-to-feature tier assignments are controlled by the Master Feature Map and remain data-driven; no Free/Premium/Premium+ mapping is hardcoded here.
- Entitlement source precedence must be supplied explicitly because the source does not settle precedence among all manual grants, promotions, trials, and internal overrides.
- `grace` subscription access requires an explicit policy. `past_due`, `expired`, and unspecified subscription states fail closed.
- Redis lock lease renewal, durable event outbox/dispatch, worker process registration, and domain-specific job handlers remain future work.
- No object-storage provider is selected.

### Verification

Infrastructure CI passed on `f774833f6b456029267cc3359dcd4be882dbfcf1`. Shared type/permission/entitlement packages passed CI on `83990171a33ede414070e8253359bbfbd67f6115`. Discord REST and event contract additions in this commit are awaiting CI.

### Next sequence

1. Verify shared packages and Discord/event contract tests.
2. Add Discord command registry and interaction/event routers with failure-safe handling.
3. Implement OAuth2/session and guild-access services from the API/security specifications.
4. Wire permission and entitlement packages to database-backed policy loaders.
5. Build Moderation Warn end-to-end with idempotency, case/warning persistence, audit logging, API/bot handlers, and tests.
