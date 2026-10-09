# Implementation Status

## Current stage: bot command and event core

This branch builds on `feat/shared-domain-packages`. It is not a production release and has not been merged into `main`.

### Implemented foundations

- Workspace, CI, PostgreSQL schema/migrations, Redis, BullMQ, and object-storage abstraction.
- Shared domain types, permission evaluation, entitlement resolution, Discord REST wrapper, and internal event contract.
- Discord OAuth2 authorization-code flow with Redis-backed one-time state, state cookie bound to the initiating browser, opaque HttpOnly session cookies, SHA-256 session-token hashes in PostgreSQL, current-user, logout, and session management.
- Same-origin protection for cookie-authenticated logout/session revocation; OAuth tokens are used only during callback and are not persisted.
- OAuth callback fetches guild membership with the granted `guilds` scope and filters to owners or users with Discord Administrator/Manage Server permission.
- Authenticated `GET /api/v1/auth/guilds` returns only manageable guilds with an active bot registry record.
- Bot syncs guild create/delete and cached guilds to the existing `Guild` model; no schema change was introduced.
- Reusable tenant-context pre-handler validates the URL guild ID, resolves the HttpOnly session, and checks the user’s server-owned access snapshot before attaching a typed guild context. `GET /api/v1/guilds/:guildId/context` exercises the guard.
- Prisma policy loaders load guild-scoped role grants and user/role overrides, reject malformed stored permission values, and map persisted entitlement rows/subscription state into the existing pure entitlement resolver contract. Unknown sources and unsafe limits fail closed.
- Bot command registry validates unique slash command names and cooldowns; slash commands register globally or to `DISCORD_DEV_GUILD_ID`.
- Interaction router handles slash commands, component interactions, and modals with Redis-backed per-user cooldowns, safe fallback responses, and structured error logs. `/vreeo-health` is the current foundation command.
- Gateway event router centralizes ready/startup sync, guild create/delete registry updates, and Discord client errors; graceful shutdown closes PostgreSQL and Redis.
- Production config requires OAuth credentials, HTTPS redirect/origin, and secure session cookies; development may leave OAuth unconfigured.

### Still not implemented

- Tenant-scoped guild-context middleware for all guild-scoped routes.
- Database-backed permission/profile and entitlement policy loaders.
- Database-backed permission/profile and entitlement policy loaders.
- Command registry/interaction router, domain services, Moderation Warn vertical slice, durable event outbox, and production deployment configuration.
- OAuth refresh-token persistence/refresh is intentionally absent because the source schema does not define a token storage field. Guild access must not assume OAuth tokens persist beyond callback.

### Verification

Infrastructure and shared package gates previously passed. The auth/session branch passed CI on `4f47c84191d742315d155000c26600f46e5b76e6`, including build, typecheck, database migrations/schema drift, seed idempotency, and the auth/session route tests. Live Discord OAuth has not been exercised because no real client credentials are configured.

### Next sequence

1. Build the Moderation Warn domain service with transaction-safe case numbering, idempotency, audit logging, and tests.
2. Before exposing warning mutations, define default permission profiles and entitlement source precedence, and design permission revalidation without persisting OAuth tokens contrary to the current source design.
3. Wire warn through bot, API, and dashboard only after those authorization policies are fully enforceable.
4. Add bot command registry and interaction/event routers.
5. Implement Moderation Warn end-to-end and expand the remaining MVP features.
