# Zlo-Go

Single-business Zalo Web-style Chat+CRM MVP.

## Architecture

- `apps/api`: NestJS API, PostgreSQL persistence, Redis Streams consumers/producers, WebSocket gateway.
- `apps/web`: React webchat UI.
- `apps/zalo-connector`: Go service that integrates with Za-go and publishes normalized events.
- `postgres`: durable application database.
- `redis`: Redis Streams event bus and queue.
- `minio`: private object storage for archived media.

## Docs

- Design: `docs/superpowers/specs/2026-05-08-zalo-chat-crm-mvp-design.md`
- Implementation plan: `docs/superpowers/plans/2026-05-08-zalo-chat-crm-mvp.md`
