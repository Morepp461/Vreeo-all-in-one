# ADR 0001: Backend framework

- **Status:** Accepted
- **Date:** 2026-10-09
- **Context:** The Technical Architecture document explicitly allows NestJS or Fastify for the API.
- **Decision:** Use Fastify for the first implementation.
- **Reasoning:** It is within the approved options and has a smaller bootstrap surface for the time-constrained first release. This is an implementation choice, not a change to product scope.
- **Consequences:** Domain logic must remain outside route handlers; route schemas, authentication, guild context, authorization, entitlement, rate limits, audit behavior, and error contracts must be enforced consistently. Revisit only if measured needs or source requirements justify it.
