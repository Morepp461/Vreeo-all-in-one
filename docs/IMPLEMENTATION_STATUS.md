# Implementation Status

## Current stage: foundation bootstrap

This branch establishes repository conventions and local infrastructure configuration. It is not a production release.

### Added in this bootstrap

- pnpm workspace and root scripts
- strict shared TypeScript compiler settings
- basic repository/editor hygiene
- local PostgreSQL and Redis Compose services with health checks
- environment-variable template
- project scope, stack direction, and repository layout documentation

### Not implemented yet

- API and bot application entrypoints
- environment schema validation
- Prisma schema, migrations, repositories, and seed data
- Redis client, cache/cooldown/rate-limit/lock/session helpers
- queue and worker process
- structured logger, metrics, health/readiness integration
- dashboard and shared package implementations
- CI workflow and automated test suite
- first end-to-end product slice (Moderation Warn)

### Verification

No dependency installation, build, typecheck, tests, or container startup has been run as part of this GitHub bootstrap. Do not interpret the files in this branch as verified or production-ready.

### Next sequence

1. Add minimal API and bot apps with validated configuration.
2. Wire PostgreSQL, Prisma, migrations, and seed workflow.
3. Wire Redis primitives and a worker/queue boundary.
4. Add structured logging, metrics, health, and readiness checks.
5. Add CI and automated checks once the dependency graph and lockfile are established.
6. Implement the first vertical slice: Moderation Warn.
