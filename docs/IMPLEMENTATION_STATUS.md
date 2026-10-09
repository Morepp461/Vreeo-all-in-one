# Implementation Status

## Current stage: core persistence foundation

This branch builds on `feat/core-infrastructure`. It is not a production release and has not been merged into `main`.

### Implemented

- pnpm workspace, strict TypeScript settings, editor/repository hygiene, and local PostgreSQL/Redis Compose configuration.
- Fastify API foundation with request IDs, Helmet, rate limiting, consistent errors, liveness, and fail-closed readiness.
- discord.js gateway process with graceful shutdown and safe mention defaults.
- Shared Zod environment validation and Pino logging with secret-field redaction.
- Prisma core schema and versioned PostgreSQL migration for identity, guild state, role/permission mappings, moderation cases/warnings/appeals, plans/plan features, feature flags, audit logs, and idempotency records.
- Idempotent baseline plan seed for the documented `free`, `premium`, and `premium_plus` plan keys.
- GitHub Actions CI with an ephemeral PostgreSQL service, Prisma validation, migration deployment, schema-drift check, typecheck, tests, and build.

### Explicitly not implemented yet

- Redis client, cache/cooldown/rate-limit/lock/session adapters, queue/worker, retry/backoff/dead-letter handling.
- Domain repository/service layer and the Moderation Warn vertical slice.
- Remaining MVP database tables for AutoMod, security events/lockdowns, welcome/verification/leveling, tickets/forms/role menus, subscriptions/entitlements/payments.
- Discord command registry, interaction/event routers, REST abstraction, and command deployment.
- OAuth2, sessions/authentication flow, guild access/context, authorization, and entitlement enforcement.
- Dashboard/admin applications and product features.
- Committed pnpm lockfile and production deployment configuration.

### Review notes

- The source specifications use both `packages/entitlements` (Technical Architecture) and `packages/premium` (Implementation Execution Plan/Engineering Backlog). The architecture and existing repository layout use `packages/entitlements`; keep that name unless a specification change explicitly resolves the discrepancy.
- The API framework remains Fastify, matching the repository direction; NestJS is an allowed alternative in the architecture source, not a reason to rewrite the existing API.
- Readiness intentionally fails closed until PostgreSQL, Redis, and queue checks are registered.
- The active guild-member-role uniqueness invariant is implemented as a PostgreSQL partial unique index in the migration, since the Prisma schema DSL cannot express that predicate directly.
- The initial database schema follows the source field-list convention: fields explicitly marked `NULL` are nullable; other fields are required. If the source specification intends a different nullability rule, update the source specification and add a migration before using those fields as product invariants.
- A committed lockfile and frozen install are still required before builds can be considered fully reproducible or release-ready.

### Verification

GitHub Actions passed on the core-infrastructure branch for TypeScript checks, tests, and build. On this database branch, Prisma schema validation, migration deployment against ephemeral PostgreSQL, schema-drift check, typecheck, and build have passed on commit `5ce8f3167389b72fbfe19db2360443835a3443a8`. The final seed step is being added to CI and must pass before this database stage is considered complete. Docker Compose startup and live Discord connection have not been verified.

### Next sequence

1. Verify repeatable baseline seeding and complete database-stage review.
2. Implement Redis primitives, queue/worker contracts, and real readiness checks.
3. Add bot command/event lifecycle and shared permission/entitlement foundations.
4. Implement the Moderation Warn vertical slice across persistence, API, bot, audit, and tests.
5. Continue with the remaining MVP modules in the source execution order.
