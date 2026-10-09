# VREEO

VREEO is an all-in-one Discord management platform built around a Discord bot, a web dashboard, and a versioned API.

> **V1 scope:** AI is explicitly out of scope. See the approved PRD, Master Feature Map, and Implementation Execution Plan for product scope and release gates.

## Repository status

This repository is being bootstrapped from the approved planning documents. The current branch contains the initial engineering foundation; it is **not yet a production-ready release**.

## Stack

- Node.js + TypeScript
- pnpm workspaces
- Discord bot: discord.js
- API: Fastify
- Dashboard: Next.js + React
- Data: PostgreSQL + Prisma (schema/migrations to follow the database specification)
- Cache/queue: Redis + BullMQ (queue workers to follow the execution plan)
- Local infrastructure: Docker Compose

Fastify is selected from the architecture document's allowed backend options (NestJS or Fastify). This choice is recorded in `docs/decisions/0001-backend-framework.md`.

## Requirements

- Node.js 22.14+
- pnpm 10+
- Docker Engine / Docker Desktop

## Quick start

1. Enable Corepack: `corepack enable`.
2. Install dependencies: `pnpm install`.
3. Copy `.env.example` to `.env` and set local values.
4. Start local services: `docker compose up -d`.
5. Start apps: `pnpm dev`.

The API health endpoint is `GET http://localhost:4000/health`. The dashboard runs at `http://localhost:3000`.

The bot intentionally refuses to start its Discord gateway without `DISCORD_BOT_TOKEN`; it does not log secrets.

## Quality commands

- `pnpm format:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

CI runs the same checks. A pnpm lockfile must be generated and committed by running `pnpm install` with the pinned package manager before the first validated release.

## Security baseline

- Never commit `.env`, bot tokens, OAuth secrets, or production credentials.
- Guild-scoped API routes must validate the authenticated user's access to the requested guild on the server.
- UI visibility is not authorization; API and bot actions must independently enforce permissions, Discord permissions, role hierarchy, and entitlements.
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
  database/    Prisma schema and migrations (next implementation phase)
  types/       Shared domain types (next implementation phase)
infrastructure/
  docker/
docs/
  decisions/
```
