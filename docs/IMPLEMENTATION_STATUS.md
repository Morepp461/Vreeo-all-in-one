# Implementation Status

## Current stage: authentication and session foundation

This branch builds on `feat/shared-domain-packages`. It is not a production release and has not been merged into `main`.

### Implemented foundations

- Workspace, CI, PostgreSQL schema/migrations, Redis, BullMQ, and object-storage abstraction.
- Shared domain types, permission evaluation, entitlement resolution, Discord REST wrapper, and internal event contract.
- Discord OAuth2 authorization-code flow with Redis-backed one-time state, state cookie bound to the initiating browser, opaque HttpOnly session cookies, SHA-256 session-token hashes in PostgreSQL, current-user, logout, and session management.
- Same-origin protection for cookie-authenticated logout/session revocation; OAuth tokens are used only to fetch identity and are not persisted.
- Production config requires OAuth credentials, HTTPS redirect/origin, and secure session cookies; development may leave OAuth unconfigured.

### Still not implemented

- Tenant-scoped authorization middleware that validates every guild-scoped mutation; the new guild listing is an access-discovery endpoint only.
- Database-backed permission/profile and entitlement policy loaders.
- Command registry/interaction router, domain services, Moderation Warn vertical slice, durable event outbox, and production deployment configuration.
- OAuth refresh-token persistence/refresh is intentionally absent because the source schema does not define a token storage field. Guild access must not assume OAuth tokens persist beyond callback.

### Verification

Infrastructure and shared package gates previously passed. The auth/session branch passed GitHub Actions on `db581629dfa7e23ee7eddd1609d3e3dfee5cb306`, including build, typecheck, database migrations/schema drift, seed idempotency, and auth/session route tests. Live Discord OAuth has not been exercised because no real client credentials are configured. Guild access changes are awaiting CI.

### Next sequence

1. Verify auth state-cookie binding, callback replay protection, session hash storage, logout CSRF checks, and session listing.
2. Add tenant-scoped guild-context middleware and database-backed permission/profile and entitlement loaders.
3. Wire permission and entitlement packages to database-backed policy loaders.
4. Add bot command registry and interaction/event routers.
5. Implement Moderation Warn end-to-end and expand the remaining MVP features.
