# Implementation Status

## Current stage: tenant-scoped guild context

This branch extends the auth/session, guild-access, and bot-sync foundations. It is not a production release and has not been merged into `main`.

### Implemented foundations

- Workspace, CI, PostgreSQL schema/migrations, Redis, BullMQ, and object-storage abstraction.
- Shared domain types, permission evaluation, entitlement resolution, Discord REST wrapper, and internal event contract.
- Discord OAuth2 authorization-code flow with Redis-backed one-time state, state cookie bound to the initiating browser, opaque HttpOnly session cookies, SHA-256 session-token hashes in PostgreSQL, current-user, logout, and session management.
- Same-origin protection for cookie-authenticated logout/session revocation; OAuth tokens are used only to fetch identity and are not persisted.
- Authenticated guild discovery filters to bot-connected guilds where the signed-in user is the owner or has Discord Manage Server/Administrator permission in the bot-synced database snapshot.
- Bot gateway synchronization for guild metadata, roles, channels, member membership, and member-role assignments; departed guild members and bot-removed guilds are marked inactive instead of destructively deleted. The bot requests Discord’s privileged Server Members Intent, which must be enabled in the Developer Portal before the bot can connect.
- Production config requires OAuth credentials, HTTPS redirect/origin, and secure session cookies; development may leave OAuth unconfigured.

### Still not implemented

- The reusable tenant guard is now exercised by `GET /api/v1/guilds/:guildId/context`; it is not yet attached to every future guild-scoped mutation route.
- The DB-backed permission loader reads guild-scoped role grants and validated user/role overrides; unconfigured permissions fail closed.
- Default permission profiles are not loaded yet: the current schema has no explicit profile/assignment contract, so no implicit profile format was invented.
- Entitlement candidate loading and action-level entitlement checks are not implemented yet.
- Command registry/interaction router, domain services, Moderation Warn vertical slice, durable event outbox, and production deployment configuration.
- OAuth access tokens are used only during callback and are not persisted. Guild access is revalidated against the bot-synced membership/role snapshot; correctness depends on successful Gateway synchronization.

### Verification

Infrastructure and shared package gates previously passed. The auth/session branch passed GitHub Actions on `db581629dfa7e23ee7eddd1609d3e3dfee5cb306`. The guild-access branch passed CI on `5149c9fe255973d719cb8547346fd6a5cf8becf8`. Bot guild synchronization passed CI on `c975cb5df11a5d5e182c0f0651acc57205075156`. Guild-context foundation passed CI on `0ccee9f5ec9f98081316273579c56d5c6008b9ed`. Permission policy changes are awaiting CI. Live Discord OAuth and live Gateway synchronization have not been exercised because no real Discord credentials are configured.

### Next sequence

1. Verify auth state-cookie binding, callback replay protection, session hash storage, logout CSRF checks, and session listing.
2. Attach the tenant guard to every guild-scoped route as those routes are implemented.
3. Finish entitlement candidate loading only after source/precedence semantics are explicit; never infer a default precedence.
4. Add bot command registry and interaction/event routers.
5. Implement Moderation Warn end-to-end and expand the remaining MVP features.
