# Database package

Prisma schema and PostgreSQL migration boundary for VREEO persistent data.

## Commands

Run from the repository root:

- `pnpm --filter @vreeo/database validate`
- `pnpm --filter @vreeo/database generate`
- `pnpm --filter @vreeo/database migrate:deploy`
- `pnpm --filter @vreeo/database migrate:status`
- `pnpm --filter @vreeo/database seed`

Set `DATABASE_URL` in the environment or local `.env` before validation/migration/seed commands. Do not point development or CI commands at production.

## Schema boundaries

The versioned migrations cover core identity, guild state, role/permission mappings, moderation cases/warnings/appeals, AutoMod, security events/trusted entities/lockdowns, verification, welcome/goodbye, logging, leveling, tickets/forms/role menus, plans/subscriptions/entitlements/payments, feature flags, audit logs, and idempotency records.

Post-MVP domains (economy, giveaways, suggestions, polls, events, achievements/rewards, announcements/notifications, wiki, partnerships, integrations, webhooks, automations/workflows, backups, server templates, analytics, and developer API tables) are not yet in this schema. Add them only through reviewed, versioned migrations.

Nullability convention: fields explicitly marked `NULL` in the source field lists are nullable; other listed fields are required in this initial interpretation. If the source specification is revised to change that convention, update the source and add a migration before using affected fields as product invariants. The migrations do not add cascading deletes for guild, moderation, audit, or financial records.

The active guild-member-role uniqueness invariant is enforced by a PostgreSQL partial unique index (`removed_at IS NULL`), kept in the migration because Prisma schema syntax cannot represent the partial predicate.

Some parent-child relationships include both `guild_id` and a parent ID. Application repositories must verify same-guild ownership in the same transaction; never trust a client-supplied parent ID as proof of tenant access.

Session values are stored as hashes/opaque identifiers, not raw browser session secrets. API keys and OAuth application secrets are not part of the current schema.
