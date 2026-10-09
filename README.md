# VREEO

VREEO is an all-in-one Discord management platform built around a Discord bot, a web dashboard, and a versioned API.

> **V1 scope:** AI is explicitly out of scope. Product scope is governed by the approved PRD, Master Feature Map, database specification, and Implementation Execution Plan.

## Current implementation status

The active bootstrap branch now includes:

- Discord OAuth2 login with state-cookie verification and server-side sessions.
- Encrypted OAuth access/refresh token storage and refresh support for manageable-server discovery.
- PostgreSQL/Prisma schema and versioned migrations.
- API liveness/readiness endpoints and consistent error responses.
- A Discord slash-command registry, command deployment script, server/user utilities, polls, and initial moderation commands (`/warn`, `/timeout`, `/kick`, `/ban`) with permission checks and case/audit records.
- A dashboard login screen, account session state, manageable-server listing, and responsive workspace shell.
- CI checks for formatting, linting, types, tests, build, and applying migrations to a clean PostgreSQL database.

**This is active development, not a production-ready release.** Feature coverage, integration tests, permission edge cases, dependency health checks, staging, deployment, monitoring, backup/restore, and rollback still need to pass the release gates. Do not invite public users based on the current foundation alone.

## Stack

- Node.js 22.14+ and TypeScript
- pnpm workspaces
- Discord bot: discord.js
- API: Fastify
- Dashboard: Next.js + React
- Data: PostgreSQL + Prisma
- Local cache/queue infrastructure: Redis (workers and queue processing are not yet wired)

Fastify is selected from the architecture document's allowed backend options (NestJS or Fastify). The choice is recorded in `docs/decisions/0001-backend-framework.md`.

## Requirements

- Node.js 22.14+
- pnpm 10+
- Docker Engine / Docker Desktop
- Discord application configured in the Discord Developer Portal

## Local setup

1. Enable Corepack: `corepack enable`.
2. Install dependencies: `pnpm install`.
3. Copy `.env.example` to `.env` and configure local values.
4. Start local services: `docker compose up -d`.
5. Apply the database migrations: `pnpm db:migrate:deploy`.
6. Start apps: `pnpm dev`.

API health: `GET http://localhost:4000/health`

API readiness: `GET http://localhost:4000/ready`

Dashboard: `http://localhost:3000`

### Discord OAuth configuration

Set `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, and `DISCORD_REDIRECT_URI` in the root `.env`. Add `http://localhost:4000/api/v1/auth/discord/callback` to the application's OAuth2 redirect URLs.

Use a unique random `SESSION_SECRET` and a separate `OAUTH_TOKEN_ENCRYPTION_KEY`, each at least 32 characters. Never reuse a production secret in development or commit real values.

For the dashboard invite link, set `NEXT_PUBLIC_DISCORD_CLIENT_ID` in `apps/dashboard/.env.local` to the same Discord application ID. This value is public and is not a bot token or client secret.

### Bot configuration

Set `DISCORD_BOT_TOKEN` in the root `.env`. The bot refuses to start without it and does not log secrets.

Register slash commands after setting `DISCORD_CLIENT_ID` (and optionally `DISCORD_GUILD_ID` for a development server):

```bash
pnpm --filter @vreeo/bot commands:deploy
```

Global command registration can take time to propagate. Prefer `DISCORD_GUILD_ID` for development.

## Quality commands

- `pnpm format:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm check` (runs the full local quality suite)

CI runs quality checks and applies migrations to a clean PostgreSQL service. Keep `pnpm-lock.yaml` committed and use frozen installs in CI.

## Security baseline

- Never commit `.env`, bot tokens, OAuth secrets, or production credentials.
- OAuth access and refresh tokens are encrypted at rest with AES-256-GCM. The encryption key must be backed up securely; rotating it requires a planned token re-encryption or re-authentication process.
- Guild-scoped API routes must validate the authenticated user's access to the requested guild on the server.
- UI visibility is not authorization; API and bot actions must independently enforce permissions, Discord permissions, role hierarchy, and entitlements.
- Moderation actions are recorded in the database; Discord API effects and database commits cannot form a single distributed transaction, so failed/pending cases require reconciliation monitoring before public release.
- Do not expose a public release until the execution plan's security, migration, backup/restore, staging, monitoring, and rollback gates pass.

## Project structure

```text
apps/
  api/         Fastify API
  bot/         Discord gateway bot
  dashboard/   Next.js user dashboard
  admin/       Reserved internal administration app
packages/
  config/      Environment validation
  logger/      Structured logging
  database/    Prisma schema and migrations
  types/       Shared domain types
infrastructure/
  docker/
docs/
  decisions/
```
