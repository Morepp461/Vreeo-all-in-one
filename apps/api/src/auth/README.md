# Authentication module

Discord OAuth2 authorization-code flow with one-time Redis-backed state, opaque random session cookies, SHA-256 session-token hashes in PostgreSQL, revocation, current-user, logout, and session-management endpoints.

OAuth access tokens are used only to fetch the Discord identity and are not persisted. Guild discovery and live guild-access authorization are separate concerns and must not trust a client-provided guild ID.
