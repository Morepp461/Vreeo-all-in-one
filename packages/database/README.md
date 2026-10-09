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

The first migration covers identity, guild state, role/permission mappings, moderation cases/warnings/appeals, plans/plan features, feature flags, audit logs, and idempotency records. Further feature tables must be added through reviewed, versioned migrations—not by editing an already-applied migration.

The source database specification marks some fields nullable explicitly and leaves nullability implicit for others. This first schema follows the document's explicit field contract; fields whose nullability is not fully specified remain a specification-review item before those fields are used as hard product invariants. The migration does not add cascading deletes for guild, moderation, audit, or financial records.

Session values are stored as hashes/opaque identifiers, not raw browser session secrets. API keys and OAuth application secrets are not part of this first migration.
