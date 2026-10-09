# Authentication module

Discord OAuth2 authorization-code flow with one-time Redis-backed state, opaque random session cookies, SHA-256 session-token hashes in PostgreSQL, revocation, current-user, logout, and session-management endpoints.

OAuth access tokens are used only to fetch the Discord identity and are not persisted. The OAuth callback fetches `/users/@me/guilds` and persists a snapshot of owner/permission bits only for active bot-installed guilds. `GET /api/v1/guilds` requires a valid session and lists guilds where the latest snapshot grants ownership, Administrator, or Manage Guild. Snapshots can become stale after login; they are discovery data only. Sensitive guild-scoped actions must revalidate current Discord membership/permissions server-side and must never trust a client-provided guild ID.
