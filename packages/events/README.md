# Events package

Internal event envelope creation and runtime validation based on the Technical Architecture event contract.

Events include an event ID for deduplication, a stable lowercase dotted event name, an ISO-compatible timestamp, optional internal/Discord entity identifiers, and metadata. This package does not claim durable delivery or exactly-once processing; queue/outbox integration and idempotent handlers remain required for distributed critical paths.
