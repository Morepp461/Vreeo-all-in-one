# VREEO

VREEO is an all-in-one Discord management platform: Discord bot, API, web dashboard, and shared infrastructure.

## Stack

- Node.js 22 + TypeScript
- pnpm workspaces + Turborepo
- discord.js
- Fastify API
- Next.js dashboard
- PostgreSQL + Redis

## Getting started

1. Install dependencies: `pnpm install`
2. Copy `.env.example` to `.env` and configure credentials.
3. Start local infrastructure: `docker compose up -d postgres redis`
4. Start apps: `pnpm dev`

This is the initial scaffold, not yet a production-ready release. OAuth/session security, migrations, permissions, and feature modules are next milestones.
