# Live Discord Permission Revalidation

## Purpose

VREEO must not treat Discord permissions captured during OAuth login as current authorization for a sensitive mutation. OAuth access tokens are not persisted by the current data model, so request-time authorization uses the bot's credentialed Discord REST client to fetch the current guild, actor membership, and role permission bitfields.

## Current implementation boundary

- `fetchLiveDiscordPermissionSnapshot` fetches the guild owner ID, current member role IDs, and current guild role permission bitfields via the shared `DiscordRestService`.
- The helper includes the guild's @everyone role when calculating the actor permission bitfield.
- Guild owner and Discord Administrator bypass individual permission-bit checks, matching Discord's guild-level permission semantics.
- Malformed responses, missing assigned roles, invalid snowflakes, and Discord REST failures are errors; callers must fail closed.
- The helper does not store or accept user OAuth access tokens. The API caller must provide a REST service configured with the bot token through its runtime secret configuration.
- The helper returns current actor permissions only. Callers still must validate VREEO permission, entitlement, tenant access, target membership, and hierarchy where the action requires them.

## Explicitly unresolved policy

The source specification lists the authorization stages and permission keys, but does not define the Discord permission bit required by every VREEO action or a complete default VREEO role-profile matrix. The helper therefore accepts required permission bits from its caller and does not map `moderation.warn` to an assumed Discord permission. Protected mutation routes must remain unavailable or deny by default until the action mapping is explicitly approved and tested.

## Required tests before mutation wiring

- Actor no longer in the guild.
- Role removed or permission bit changed after OAuth login.
- Owner and Administrator bypass.
- Missing required Discord permission.
- Unknown/invalid action-to-permission mapping fails closed.
- Discord REST 403/404/429 and malformed payload behavior.
- Guild access, VREEO permission, entitlement, target validation, and idempotency remain independent gates.
