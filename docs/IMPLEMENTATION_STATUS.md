# Implementation Status

## Current stage: authentication and guild access foundation

This branch builds on `feat/shared-domain-packages`. It is not a production release and has not been merged into `main`.

### Implemented foundations

- Workspace, CI, PostgreSQL schema/migrations, Redis, BullMQ, and object-storage abstraction.
- Shared domain types, permission evaluation, entitlement resolution, Discord REST wrapper, and internal event contract.
- Discord OAuth2 authorization-code flow with Redis-backed one-time state, state cookie bound to the initiating browser, opaque HttpOnly session cookies, SHA-256 session-token hashes in PostgreSQL, current-user, logout, and session management.
- Same-origin protection for cookie-authenticated logout/session revocation; OAuth tokens are used only to fetch identity and are not persisted.
- Authenticated `GET /api/v1/guilds` lists active guilds with a current `GuildMember` cache row linked to the signed-in user. It returns no guilds when no qualifying rows exist; it does not trust a client-supplied guild ID.
- Production config requires OAuth credentials, HTTPS redirect/origin, and secure session cookies; development may leave OAuth unconfigured.

### Still not implemented

- Live guild discovery from Discord OAuth and tenant-scoped guild-context middleware. The guild list currently depends on synchronized `GuildMember` rows; bot membership synchronization is not yet implemented.
- Database-backed permission/profile and entitlement policy loaders.
- Command registry/interaction router, domain services, Moderation Warn vertical slice, durable event outbox, and production deployment configuration.
- OAuth refresh-token persistence/refresh is intentionally absent because the source schema does not define a token storage field. Guild access must not assume OAuth tokens persist beyond callback.

### Verification

Infrastructure and shared package gates previously passed. The guild-access branch passed GitHub Actions on `2579caec2d4d8590b81f73c5251c915c6a360849`, including build, typecheck, Prisma migration/schema-drift checks, seed idempotency, and tests. The new guild-list route is covered for anonymous rejection and user-scoped response data. Live Discord OAuth and live guild membership sync have not been exercised. Live Discord OAuth has not been exercised because no real client credentials are configured.

### Next sequence

1. Verify auth state-cookie binding, callback replay protection, session hash storage, logout CSRF checks, and session listing.
2. Implement bot guild/member synchronization and server-resolved guild-context middleware; never accept guild access based only on a client-provided ID.
3. Wire permission and entitlement packages to database-backed policy loaders.
4. Add bot command registry and interaction/event routers.
5. Implement Moderation Warn end-to-end and expand the remaining MVP features.
