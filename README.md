# VREEO

VREEO is an all-in-one Discord community management platform built around a Discord bot, web dashboard, admin application, and shared API/services. It is designed as a platform with clear boundaries—not a large bot with a dashboard bolted on.

## V1 principles

- **AI is out of scope for V1.** It may be evaluated as a separate future module.
- Keep domain logic and shared contracts out of individual app entrypoints.
- Prefer explicit permissions, auditability, and safe defaults for administrative actions.
- Infrastructure and verification status must be documented honestly; a scaffold is not production-ready.

## Planned stack

- Node.js 22+
- TypeScript, pnpm workspaces
- discord.js for the Discord gateway bot
- Fastify for the API
- Next.js for the dashboard
- PostgreSQL with Prisma migrations for durable data
- Redis for caching, cooldowns, rate limits, locks, and sessions
- Structured Pino logging and GitHub Actions CI

## Repository layout

```text
apps/
  api/          Fastify HTTP API
  bot/          Discord gateway process
  dashboard/    Next.js dashboard (not implemented yet)
  admin/        Internal admin application (not implemented yet)
packages/
  config/       Shared environment validation
  types/        Stable permission/feature identifiers, DTOs, and event contracts
  permissions/  Central authorization evaluator
  entitlements/ Central feature/plan entitlement resolution
  database/     Prisma schema, core/MVP migrations, seed, and client boundary
  redis/        Shared Redis connection, cache, cooldown, and lock primitives
  storage/      Provider-neutral object-storage contract
  discord/      Shared Discord REST adapter, hierarchy/permission checks
  events/       Internal event contracts/bus (not implemented yet)
  logger/       Structured logging
  permissions/  Central authorization evaluator
  queue/        BullMQ queue/worker helpers, retries, idempotent enqueue, and DLQ
  types/        Stable shared domain contracts
  utils/        Shared utilities (not implemented yet)
infrastructure/ Deployment configuration (not implemented yet)
docs/
  IMPLEMENTATION_STATUS.md
```

## Local prerequisites

- Node.js 22 or newer
- pnpm 10.18.0
- Docker Engine or Docker Desktop with Compose

## Getting started

1. Install dependencies: `pnpm install`
2. Copy `.env.example` to `.env`.
3. Start local infrastructure: `pnpm infra:up`
4. Apply migrations: `pnpm --filter @vreeo/database migrate:deploy`
5. Seed the baseline plan records: `pnpm --filter @vreeo/database seed`
6. Fill in a valid `DISCORD_TOKEN` if running the bot, then use `pnpm dev`.

The API exposes `GET /health` for liveness and `GET /health/ready` for PostgreSQL, Redis, and BullMQ readiness. Discord OAuth login uses state/PKCE, stores only a hash of the opaque session token, and exposes `GET /api/v1/auth/me`, `GET /api/v1/auth/sessions`, and `GET /api/v1/auth/guilds`. Guild discovery is refreshed during login and lists only servers where the user is owner or has Administrator/Manage Server, and where the bot registry confirms the bot is installed. The bot syncs its guild registry to PostgreSQL. `GET /api/v1/guilds/:guildId/context` demonstrates the session-bound tenant guard. Prisma-backed loaders now bridge stored role grants/overrides and entitlement rows to the pure policy evaluators. Guild permissions are a login-time snapshot; Discord permission changes are not revalidated until another login, so this is not yet sufficient alone for production-sensitive mutations. Dashboard UI, command routing, and moderation domain actions are still in progress.

## Security

Never commit real tokens, passwords, or production environment files. The credentials in the Compose file are development-only and must not be reused outside local development.

## Status

See [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md) for implemented work, known gaps, and verification status.
