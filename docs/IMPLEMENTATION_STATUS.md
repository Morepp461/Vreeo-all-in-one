# Implementation Status

## Current stage: core persistence foundation

This branch builds on `feat/core-infrastructure`. It is not a production release and has not been merged into `main`.

### Implemented

- pnpm workspace, strict TypeScript settings, repository hygiene, and local PostgreSQL/Redis Compose configuration.
- Fastify API foundation with request IDs, Helmet, rate limiting, consistent errors, liveness, and fail-closed readiness.
- discord.js gateway process with graceful shutdown and safe mention defaults.
- Shared Zod environment validation and Pino logging with secret-field redaction.
- Prisma schema and versioned PostgreSQL migrations for identity, guild state, roles/permissions, moderation cases/warnings/appeals, AutoMod, security events/trusted entities/lockdowns, verification, welcome/goodbye, logging, leveling, tickets/forms/role menus, plans/subscriptions/entitlements/payments, feature flags, audit logs, and idempotency.
- Idempotent baseline plan seed for the documented `free`, `premium`, and `premium_plus` keys.
- GitHub Actions CI with ephemeral PostgreSQL, Prisma validation, migration deployment, seed execution twice, schema-drift check, typecheck, tests, and build.

### Explicitly not implemented yet

- Redis client, cache/cooldown/rate-limit/lock/session adapters, queue/worker, retry/backoff/dead-letter handling.
- Domain repository/service layer and the Moderation Warn vertical slice.
- Post-MVP database modules: economy, giveaways, suggestions, polls, events, achievements/rewards, announcements/notifications, wiki, partnerships, integrations, webhooks, automations/workflows, backups, server templates, analytics, and developer API tables.
- Discord command registry, interaction/event routers, REST abstraction, and command deployment.
- OAuth2 login flow, web sessions/authentication, guild access/context, authorization, and entitlement enforcement.
- Dashboard/admin applications and product features.
- Committed pnpm lockfile and production deployment configuration.

### Review notes

- The source specifications use both `packages/entitlements` (Technical Architecture) and `packages/premium` (Implementation Execution Plan/Engineering Backlog). The architecture and existing repository layout use `packages/entitlements`; keep that name unless a specification change explicitly resolves the discrepancy.
- The API framework remains Fastify, matching the repository direction; NestJS is an allowed alternative in the architecture source, not a reason to rewrite the existing API.
- Readiness intentionally fails closed until PostgreSQL, Redis, and queue checks are registered.
- The active guild-member-role uniqueness invariant is implemented as a PostgreSQL partial unique index because Prisma schema syntax cannot represent its predicate directly.
- Nullability convention: fields explicitly marked `NULL` in the source field lists are nullable; other listed fields are required in this initial interpretation. If the source specification is revised to change that convention, update the source and add a migration before using affected fields as product invariants.
- Some relations include both a guild ID and a parent entity ID. Repository/service transactions must verify that both refer to the same guild; do not trust a parent ID supplied by a client without checking tenant ownership.
- A committed lockfile and frozen install are still required before builds can be considered fully reproducible or release-ready.

### Verification

GitHub Actions passed on commit `d33e4915bf4336322ed836f75265acb1be009a84`: Prisma schema validation, build/client generation, both PostgreSQL migrations, idempotent plan seed run twice, schema-drift check, TypeScript typecheck, tests, and build. CI uses an ephemeral PostgreSQL instance. Local Docker Compose startup, Redis integration, and live Discord connection have not been verified.

### Next sequence

1. Add domain repositories and transactional service boundaries for the first vertical slice.
2. Implement Redis primitives, queue/worker contracts, and real readiness checks.
3. Add bot command/event lifecycle and shared permission/entitlement foundations.
4. Implement Moderation Warn end-to-end across persistence, API, bot, audit, and tests.
5. Continue with remaining MVP features in the source execution order.
