# ADR-0001: Infrastructure package boundaries

- **Status:** Accepted for implementation, additive to the source architecture
- **Date:** 2026-10-09
- **Scope:** VREEO monorepo infrastructure packages

## Context

The Technical Architecture repository tree lists `database`, `config`, `types`, `permissions`, `entitlements`, `logger`, `discord`, `events`, `queue`, and `utils`. The Implementation Execution Plan additionally requires Redis cache/cooldown/rate-limit/lock/session primitives and an object-storage abstraction, but the package tree does not assign those responsibilities to a package.

## Decision

Add two focused packages without renaming or moving existing packages:

- `packages/redis`: Redis connection lifecycle, namespaced key helpers, cache, cooldown, lock, and health primitives.
- `packages/storage`: provider-neutral object-storage contract only.

`packages/queue` remains responsible for BullMQ queues, workers, retries, idempotency helpers, and dead-letter routing. It reuses the Redis connection contract rather than owning unrelated cache/session behavior.

## Consequences

- Existing app and package paths remain unchanged.
- No object-storage provider is selected; provider-specific implementation is deferred until the deployment/provider requirements are specified.
- Redis locks use compare-and-delete token release. There is no lease renewal yet; callers must use a TTL longer than the bounded critical section.
- The architecture source should eventually include these additive boundaries so the source tree and implementation plan do not drift.
