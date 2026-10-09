# Implementation Status

## Current stage: infrastructure foundation

This branch builds on `feat/database-foundation`. It is not a production release and has not been merged into `main`.

### Implemented and verified before this branch

- Fastify API and Discord gateway foundations.
- Shared Zod configuration and Pino logger.
- Prisma schema and PostgreSQL migrations for core/MVP persistence.
- GitHub Actions checks for schema validation, PostgreSQL migrations, idempotent plan seeding, schema drift, typecheck, tests, and build.

### In progress on this branch

- Shared Redis connection and primitives for namespaced keys, JSON cache, cooldowns, readiness, and safe distributed locks.
- Provider-neutral object-storage interface; no concrete provider has been selected or configured.

### Not implemented yet

- BullMQ queue/worker runtime, bounded retries/backoff, dead-letter queue, and idempotent job enqueue.
- Redis-backed API rate limiting and full readiness integration.
- Metrics and production observability.
- Domain repositories and the Moderation Warn vertical slice.
- OAuth2/session auth, guild context, permissions/entitlements, dashboard/admin, and Discord command/event routing.
- Post-MVP database domains listed in the database package README.
- Committed pnpm lockfile and production deployment configuration.

### Architecture decisions

- The Technical Architecture package tree has no dedicated Redis or storage package, while the execution plan requires Redis primitives and an object-storage abstraction. This branch adds `packages/redis` and `packages/storage` as additive boundaries, documented in `docs/decisions/ADR-0001-infrastructure-package-boundaries.md`; existing package names and app boundaries remain intact.
- The source documents disagree between `packages/entitlements` and `packages/premium`; no renaming is performed.
- No concrete object-storage provider is assumed.
- Redis locks use token-checked release; lease renewal is not implemented, so lock TTL must exceed the bounded operation duration.
- Queue job payloads should contain references rather than secrets; DLQ records must not copy raw job payloads.

### Verification status

Core API and database migrations passed CI on the prior branches. The current Redis/storage additions must pass their own build and typecheck before queue integration proceeds. PostgreSQL and Redis are available as ephemeral CI services; local Docker startup and live Discord connection remain unverified.

### Next sequence

1. Finish Redis primitive tests and wire Redis-backed rate limiting/readiness.
2. Add BullMQ queue/worker retry, backoff, DLQ, and idempotency.
3. Add metrics/readiness integration and re-review infrastructure gates.
4. Continue shared packages, authentication/guild context, permissions/entitlements, API/bot core, then Moderation Warn.
