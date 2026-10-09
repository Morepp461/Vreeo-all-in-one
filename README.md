# VREEO

VREEO is an all-in-one Discord community management platform built around a Discord bot, a web dashboard, and shared API/services. It is designed as a platform with clear boundaries—not a large bot with a dashboard bolted on.

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
- PostgreSQL for durable data
- Prisma for database access and migrations
- Redis for caching, cooldowns, rate limits, locks, and sessions

## Repository layout

```text
apps/
  api/          Fastify HTTP API
  bot/          Discord gateway process
  dashboard/    Main web dashboard (planned)
packages/
  config/       Shared configuration and environment validation
  database/     Prisma schema, migrations, and repository layer
  discord/      Shared Discord adapters and helpers
  entitlements/ Feature availability and plan rules
  logger/       Structured logging
  permissions/  Shared authorization primitives
  queue/        Background job contracts and workers
  types/        Shared domain contracts
  utils/        Small, dependency-light utilities
docs/
  IMPLEMENTATION_STATUS.md
```

## Local prerequisites

- Node.js 22 or newer
- pnpm 10
- Docker Engine or Docker Desktop with Compose

## Getting started

1. Install dependencies: `pnpm install`
2. Copy `.env.example` to `.env` and fill in the Discord credentials if you intend to run the bot.
3. Start local infrastructure: `pnpm infra:up`
4. Start the API and bot: `pnpm dev`

The API health endpoint is intended to be `GET /health`. Application entrypoints are not implemented yet, so the dev command is not runnable at this stage.

## Implementation status

This repository is being bootstrapped. See [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md) for what exists and what has—and has not—been verified.

## Security

Never commit real tokens, passwords, or production environment files. The credentials in the Compose file are development-only and must not be reused outside local development.
