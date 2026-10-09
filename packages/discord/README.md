# Discord package

Controlled Discord REST boundary for rate-limit handling, normalized errors, operation-level logging/metrics hooks, and hierarchy/permission guards.

The adapter delegates rate-limit scheduling/retries to discord.js REST. Domain services must still validate VREEO authorization, target/guild ownership, and action invariants before calling it. Request bodies, bot tokens, and raw exception messages are never logged by this wrapper.
