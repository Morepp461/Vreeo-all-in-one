# Implementation Status

## Current stage: authentication, guild discovery, and bot guild sync

This branch builds on `feat/shared-domain-packages`. It is not a production release and has not been merged into `main`.

### Implemented foundations

- Workspace, CI, PostgreSQL schema/migrations, Redis, BullMQ, and object-storage abstraction.
- Shared domain types, permission evaluation, entitlement resolution, Discord REST wrapper, and internal event contract.
- Discord OAuth2 authorization-code flow with Redis-backed one-time state, state cookie bound to the initiating browser, opaque HttpOnly session cookies, SHA-256 session-token hashes in PostgreSQL, current-user, logout, and session management.
- Same-origin protection for cookie-authenticated logout/session revocation; OAuth tokens are used only to fetch identity and are not persisted.
- OAuth callback validates the `guilds` scope and fetches the user's current Discord guild list. A dedicated `UserGuildAccess` snapshot stores only guild permission bits, ownership, and verification timestamp for active bot-installed guilds; OAuth access tokens are not persisted.
- Authenticated `GET /api/v1/guilds` lists active bot-installed guilds where the latest OAuth snapshot marks the user as owner or grants Administrator/Manage Guild. A snapshot is discovery data, not a substitute for live server-side authorization on mutations.
- Production config requires OAuth credentials, HTTPS redirect/origin, and secure session cookies; development may leave OAuth unconfigured.

### Still not implemented

- Tenant-scoped guild-context middleware and live revalidation of Discord membership/permissions before sensitive actions. OAuth guild snapshots can become stale after login and must not alone authorize mutations.
- Database-backed permission/profile and entitlement policy loaders.
- Command registry/interaction router, domain services, Moderation Warn vertical slice, durable event outbox, and production deployment configuration.
- OAuth refresh-token persistence/refresh is intentionally absent because the source schema does not define a token storage field. Guild access must not assume OAuth tokens persist beyond callback.
- Bot gateway synchronizes active guild metadata into `guilds` at startup and on guild create/update/delete. Startup sync is concurrency-bounded; temporary guild-unavailability events do not deactivate a guild. This does not synchronize member/role state or replace live authorization checks.

### Verification

Infrastructure and shared package gates previously passed. The guild-access branch passed GitHub Actions on `2579caec2d4d8590b81f73c5251c915c6a360849`. The live-guild-discovery branch passed CI after correcting guild ID/permission-bitfield validation. The bot guild-sync branch passed GitHub Actions on `df54c1a49b8ed84d4f33b16a86e191df95940275`, including Prisma migration/schema drift, build, typecheck, and tests. No real Discord OAuth credentials are configured, so external OAuth behavior has not been exercised. Live Discord OAuth has not been exercised because no real client credentials are configured.

### Next sequence

1. Verify auth state-cookie binding, callback replay protection, session hash storage, logout CSRF checks, and session listing.
2. Implement server-resolved guild-context middleware with live Discord membership/permission checks; never authorize sensitive actions from a cached OAuth snapshot or client-provided guild ID.
3. Wire permission and entitlement packages to database-backed policy loaders.
4. Add bot command registry and interaction/event routers.
5. Implement Moderation Warn end-to-end and expand the remaining MVP features.
