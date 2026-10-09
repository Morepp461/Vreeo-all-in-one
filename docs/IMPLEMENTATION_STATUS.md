# Implementation Status

## Current stage: infrastructure foundation

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

### Not implemented yet

- Dedicated worker process and concrete domain job handlers; queue primitives exist but no business jobs are registered yet.
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

GitHub Actions passed on commit `92b71f6928bbb7206dceb2236f15e8c73185e3f8`, including Redis primitive and queue retry/idempotency/DLQ integration tests, Prisma validation and migrations, schema drift, typecheck, and build. The API queue-readiness integration in this commit is awaiting CI. PostgreSQL and Redis are ephemeral CI services; local Docker startup and live Discord connection remain unverified.

### Next sequence

1. Verify API readiness against PostgreSQL, Redis, and BullMQ in CI.
2. Review remaining shared-package boundaries and define domain contracts.
3. Implement OAuth2/session and guild-access foundations.
4. Implement centralized permissions and entitlements before moderation actions.
5. Build Moderation Warn end-to-end with idempotency, case/warning persistence, audit logging, API/bot handlers, and tests.
