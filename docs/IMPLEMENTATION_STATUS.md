# Implementation Status

## Current stage: Moderation Warn domain persistence

This is a stacked feature branch based on `feat/bot-command-core`. It is not a production release and has not been merged into `main`.

### Implemented foundations

- Workspace, CI, PostgreSQL schema/migrations, Redis, BullMQ, and object-storage abstraction.
- Shared domain types, central permission evaluator, entitlement resolver, Discord REST wrapper, and internal event contract.
- Discord OAuth2 authorization-code flow with Redis-backed one-time state, state cookie bound to the initiating browser, opaque HttpOnly session cookies, SHA-256 session-token hashes in PostgreSQL, current-user, logout, and session management.
- Authenticated guild discovery filters to owners or users with Discord Administrator/Manage Server permissions and intersects results with the bot's active guild registry.
- Bot synchronizes guild create/delete and cached guilds to PostgreSQL.
- Tenant-context middleware validates the Discord guild ID, resolves the session, checks the server-owned access snapshot, and keeps the internal UUID separate from the public Discord snowflake.
- Prisma policy loaders bridge stored role grants/overrides and entitlement rows/subscription state to the existing pure policy evaluators. Unknown entitlement sources, malformed permission rows, and unsafe limits fail closed.
- Bot command registry, global/development-guild slash command registration, Redis-backed per-user cooldowns, component/modal routers, gateway event router, graceful shutdown, and the `/vreeo-health` foundation command.
- Moderation Warn domain service writes the moderation case, warning record, audit log, and idempotency response in one PostgreSQL transaction. It serializes case-number allocation by locking the guild row, stores hashes instead of raw idempotency keys, replays matching requests, and rejects key reuse with a different request.
- Warning service validates target/moderator snowflakes, non-empty reason, future expiry values, active bot-installed guild, and actor identity when an internal user ID is supplied. Idempotency retention expiry is passed by the caller instead of being guessed.

### Important limits

- The warning service is **not yet wired to an API endpoint, Discord `/moderation warn` command, or dashboard**. It is a persistence/domain layer only; callers must complete authorization before invoking it.
- Guild permissions are a login-time OAuth snapshot. Since OAuth tokens are not persisted in the current schema, permission changes made in Discord after login are not revalidated yet. Do not use this snapshot alone for production-sensitive mutations.
- The source specs define conceptual default role profiles but not a complete permission matrix. The policy loader therefore requires the caller to supply default permissions; no profile mapping is invented here.
- Entitlement source precedence must be explicit, and grace access is policy-defined. Those policies are not silently hardcoded. The baseline plan seed currently creates plans but does not yet assign a Free plan entitlement to every guild.
- Real Discord OAuth and slash-command registration have not been exercised with production credentials.

### Verification

GitHub Actions passed on commit `209d45a5adbac3ddc397b59327f5166a6815be84`, including Prisma validation, build, migrations/schema drift, seed idempotency, typecheck, and tests. Database-backed warning tests cover persistence, audit records, idempotent replay/conflict, concurrent retries/case numbering, invalid input, inactive guild rejection, and actor mismatch rejection.

### Next sequence

1. Define the live guild/Discord permission revalidation strategy without storing OAuth tokens contrary to the current source design.
2. Define explicit entitlement precedence and Free-plan provisioning from the source specifications; keep unspecified policy fail-closed.
3. Wire the warning service to the bot and API only after VREEO permission, Discord permission, entitlement, target/hierarchy, and tenant checks are enforceable.
4. Build the dashboard moderation history and warning flow, then continue through the remaining MVP backlog.
