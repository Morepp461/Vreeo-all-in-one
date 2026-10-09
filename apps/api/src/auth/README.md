# Authentication module

Discord OAuth2 authorization-code flow with one-time Redis-backed state, opaque random session cookies, SHA-256 session-token hashes in PostgreSQL, revocation, current-user, logout, and session-management endpoints.

OAuth access tokens are used only to fetch the Discord identity and are not persisted. `GET /api/v1/guilds` requires a valid session and lists active guilds only when a `GuildMember` row is linked to the current user and marked as a current member. Until bot membership synchronization exists, this list may be empty. Guild-context authorization must resolve guild access server-side and must never trust a client-provided guild ID.
