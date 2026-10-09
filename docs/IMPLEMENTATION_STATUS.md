# Implementation Status

## Current stage: shared domain contracts and authorization foundations

This branch builds on `feat/database-foundation`. It is not a production release and has not been merged into `main`.

### Implemented and verified before this branch

- Fastify API and Discord gateway foundations.
- Shared Zod configuration and Pino logger.
- Prisma schema and PostgreSQL migrations for core/MVP persistence.
- GitHub Actions checks for schema validation, PostgreSQL migrations, idempotent plan seeding, schema drift, typecheck, tests, and build.

### Implemented on this branch

- Shared Redis connection and primitives for namespaced keys, JSON cache, cooldowns, readiness, and token-checked distributed locks.
- BullMQ queue/worker helpers with bounded retries, exponential backoff, idempotent enqueue, and payload-free dead-letter records.
- Provider-neutral object-storage interface; no concrete provider has been selected or configured.
- Redis-backed API rate limiting and readiness checks for PostgreSQL, Redis, and BullMQ backend.

### Implemented on this branch

- Shared domain identifiers and DTO/event contracts in `packages/types`.
- Central permission evaluator covering authentication, guild-context match, Discord permission/hierarchy checks, explicit override precedence, server-loaded role permission sets, and configured default profiles.
- Pure entitlement resolver with explicit source precedence, expiration, subscription-state handling, and fail-closed behavior for unknown states.
- Regression tests cover tenant isolation, runtime unknown permission denial, role-level grants/denies, entitlement expiration, and subscription states.

### Not implemented yet

- OAuth2/session authentication and persistent browser session lifecycle.
- Guild discovery/access service and route middleware wired to live database/Discord data.
- Domain repositories and the Moderation Warn vertical slice.
- Dedicated worker process and concrete domain job handlers; queue primitives exist but no business jobs are registered yet.
- Metrics and production observability.
- Dashboard/admin and Discord command/event routing.
- Post-MVP database domains listed in the database package README.
- Committed pnpm lockfile and production deployment configuration.

### Architecture decisions

- The Technical Architecture package tree has no dedicated Redis or storage package, while the execution plan requires Redis primitives and an object-storage abstraction. This branch adds `packages/redis` and `packages/storage` as additive boundaries, documented in `docs/decisions/ADR-0001-infrastructure-package-boundaries.md`; existing package names and app boundaries remain intact.
- The source documents disagree between `packages/entitlements` and `packages/premium`; no renaming is performed.
- No concrete object-storage provider is assumed.
- Redis locks use token-checked release; lease renewal is not implemented, so lock TTL must exceed the bounded operation duration.
- Queue job payloads should contain references rather than secrets; DLQ records must not copy raw job payloads.

### Verification status

GitHub Actions passed on commit `83990171a33ede414070e8253359bbfbd67f6115`, including infrastructure checks plus shared types, permission precedence/tenant-isolation tests, and entitlement-resolution tests. PostgreSQL and Redis are ephemeral CI services; local Docker startup and live Discord connection remain unverified.

### Next sequence

1. Implement OAuth2 state validation, Discord identity exchange, secure cookie/session lifecycle, logout, and session revocation.
2. Implement guild discovery/access validation with server-side Discord permission lookup and tenant-scoped repositories.
3. Wire the permission and entitlement packages to database-backed policy loaders.
4. Implement bot command registry and interaction routing.
5. Build Moderation Warn end-to-end with idempotency, case/warning persistence, audit logging, API/bot handlers, and tests.
