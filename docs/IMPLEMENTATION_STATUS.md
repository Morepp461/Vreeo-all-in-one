# Implementation Status

## Current stage: core application foundation

This branch builds on `feat/foundation-bootstrap`. It is not a production release and has not been merged into `main`.

### Implemented in this stage

- Minimal Fastify API application with request IDs, Helmet, global rate limiting, and consistent error responses.
- Liveness endpoint at `GET /health`.
- Readiness endpoint at `GET /health/ready` that returns HTTP 503 until real dependency checks are registered; it does not falsely claim PostgreSQL/Redis/queue readiness.
- Minimal discord.js gateway process with graceful shutdown and safe mention defaults.
- Shared Zod environment validation for API and bot startup.
- Shared Pino logger with secret-field redaction.
- Unit tests for environment parsing and API health/error behavior.
- Initial GitHub Actions verification workflow.

### Explicitly not implemented yet

- PostgreSQL client, Prisma schema/migrations/repositories/seeds.
- Redis client and cache/cooldown/rate-limit/lock/session adapters.
- Queue/worker and idempotent job execution.
- Discord command registry, interaction/event routers, REST abstraction, and command deployment.
- Authentication, OAuth2, sessions, guild access/context, authorization, and entitlements.
- Dashboard/admin applications and product features.
- Committed dependency lockfile and verified green CI.

### Review notes

- The source specifications use both `packages/entitlements` (Technical Architecture) and `packages/premium` (Implementation Execution Plan/Engineering Backlog). The architecture and current repository layout use `packages/entitlements`; keep that name unless a specification change explicitly resolves the discrepancy.
- The repository currently uses Fastify as the API framework, matching the current README direction. NestJS remains an allowed alternative in the architecture document, not a reason to rewrite the API.
- The current API readiness check intentionally fails closed until PostgreSQL, Redis, and queue health checks are wired in a later stage.
- The CI workflow currently allows lockfile generation because no pnpm lockfile exists yet. A committed lockfile and frozen install are required before calling builds reproducible or release-ready.
- Root development/test/typecheck scripts build shared packages first because app packages resolve their generated package entrypoints.

### Verification status

GitHub Actions successfully installed the workspace dependencies on the previous CI attempt, then TypeScript checking failed. That failure exposed Fastify logger typing and error narrowing issues; fixes are now committed, but a CI run against the latest commit is still required. Tests, full build, Docker startup, database migrations, and a live Discord connection have not yet been verified. Do not interpret this branch as production-ready.

### Next sequence

1. Get the API/bot foundation through green CI and review the actual build/test output.
2. Deep-review and implement the database schema/migration foundation against the source database specification.
3. Add Redis/queue primitives and real readiness checks.
4. Add the bot command/event lifecycle and API module boundaries.
5. Add authorization and entitlement foundations before protected feature actions.
6. Implement the first end-to-end vertical slice: Moderation Warn.
