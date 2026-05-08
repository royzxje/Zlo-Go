# Zalo Chat CRM MVP Design

Date: 2026-05-08

## Summary

Build a single-business webchat platform that connects to one Zalo account through the unofficial Za-go library. The MVP prioritizes reliable realtime chat, durable message/media storage, and manual conversation assignment for a small team of agents. CRM features are intentionally limited to identity and thread foundations so the product can later expand into a full Chat+CRM without weakening the chat core.

## Goals

- Support one business with one connected Zalo account.
- Support multiple internal users with `OWNER`, `MANAGER`, and `AGENT` roles.
- Support both Zalo `USER` and `GROUP` threads.
- Receive and send realtime messages through Za-go.
- Preserve all normalized messages and raw Zalo payloads.
- Archive images/files into private object storage when possible, while retaining source metadata for retry.
- Provide manual conversation assignment.
- Run the MVP on one VPS using Docker Compose.

## Non-Goals

- Multi-tenant operation.
- Multiple Zalo accounts.
- CRM pipeline, deals, tasks, reminders, or custom fields.
- Advanced search using Elasticsearch/OpenSearch.
- Voice/video sending.
- Realtime calls or group calls.
- Full group administration actions.
- Automatic routing or queue assignment.
- Native mobile apps.

## Architecture

The MVP uses an event-driven architecture with Redis Streams between the Zalo connector and the application API.

| Service | Responsibility |
| --- | --- |
| `web` | React webchat UI for Owner, Manager, and Agent users. |
| `api` | NestJS API, auth, authorization, assignment, websocket gateway, PostgreSQL writes, Redis consumers/producers. |
| `zalo-connector` | Go service using Za-go for QR login, session handling, websocket listening, sending messages, and publishing normalized events. |
| `redis` | Redis Streams for Zalo events and commands, plus lightweight presence/job coordination. |
| `postgres` | Main durable database for users, threads, messages, assignments, media metadata, raw payloads, and audit logs. |
| `minio` | S3-compatible private object storage for archived media. |
| `media-worker` | Worker that downloads media from source URLs and stores it in MinIO with retry handling. |

Ownership boundaries:

- `zalo-connector` owns Zalo protocol concerns: QR auth, sessions, Za-go callbacks, send/upload APIs, reconnect behavior.
- `api` owns application state: users, roles, assignments, conversations, messages, media records, audit trails.
- Redis Streams decouple Zalo ingestion from database writes and reduce message loss during service restarts.
- React talks only to NestJS over HTTP/WebSocket and never directly to the Go connector.
- `zalo-connector` does not write directly to PostgreSQL in the MVP.
- `api` does not import Za-go or depend on Za-go internal types.

## Realtime Data Flow

### Receiving Messages

1. `zalo-connector` starts Za-go with `Listen(thread=true, reconnect=N)`.
2. Za-go emits callbacks for messages, group events, delivered, seen, errors, uploads, and listening status.
3. The connector maps each callback into an internal event and publishes it to Redis Stream `zalo.events`.
4. `api` consumes `zalo.events` with a Redis consumer group.
5. `api` idempotently upserts threads, contacts, participants, messages, media metadata, receipts, and raw payloads in PostgreSQL.
6. If a message contains media, `api` creates a media archival job.
7. `api` emits websocket events to clients watching the affected conversation or conversation list.
8. `api` ACKs the Redis event only after successful durable database writes.

### Sending Messages

1. An agent sends a message from React through NestJS.
2. `api` checks authentication, role, assignment policy, and thread state.
3. `api` creates a local outbound message with status `queued` or `sending`.
4. `api` writes an `outbound_commands` row and publishes a command to Redis Stream `zalo.commands`.
5. `zalo-connector` consumes the command and calls the matching Za-go API.
6. The connector publishes `message.send_succeeded` or `message.send_failed` to `zalo.events` with the same `command_id`.
7. `api` idempotently updates the message status and emits realtime updates to clients.

The UI may show optimistic outbound messages immediately, but Za-go command results are the source of truth for final delivery state.

### Media Archival

1. Message ingestion stores media source metadata immediately, including Zalo/source URL if available.
2. Media records start with `archive_status=pending`.
3. `media-worker` downloads media and writes it to MinIO using stable keys such as `zalo/{threadId}/{messageId}/{mediaId}`.
4. On success, the worker updates `archive_status=archived`, `storage_bucket`, `storage_key`, size, and checksum when available.
5. On failure, the worker records `last_error`, increments `retry_count`, and marks the asset as `failed_retryable` or `failed_permanent`.

Messages are durable even if media archival fails. Failed media can be retried later.

### Delivered, Seen, Typing, And Status

- Delivered and seen events update message receipts or aggregate message status.
- Typing events are transient and emitted over WebSocket with a short TTL; they are not stored permanently.
- Connector status events are stored or cached so admins can see `qr_required`, `listening`, `reconnecting`, `session_expired`, and `error` states.

## PostgreSQL Data Model

Core tables:

| Table | Purpose |
| --- | --- |
| `users` | Internal users with Owner, Manager, or Agent roles. |
| `zalo_accounts` | The connected Zalo account and its public/account metadata. |
| `zalo_sessions` | Encrypted Zalo session/cookie data and auth state. |
| `contacts` | Zalo user identities used as CRM foundations. |
| `threads` | Zalo USER/GROUP conversations. |
| `thread_participants` | Participants in USER/GROUP threads. |
| `conversation_assignments` | Manual assignment of conversations to internal users. |
| `messages` | Normalized messages. |
| `message_raw_payloads` | Raw Za-go/Zalo payloads for debugging and remapping. |
| `message_receipts` | Delivered/seen records. |
| `message_reactions` | Message reactions. |
| `media_assets` | Media metadata and archive state. |
| `outbound_commands` | Send/reaction/undo command trace and retry/debug state. |
| `connector_events` | Connector login/listening/reconnect/error history. |
| `audit_logs` | Important internal user actions. |

Important constraints and indexes:

- `threads` unique key: `(zalo_account_id, zalo_thread_id, thread_type)`.
- `contacts` unique key: `(zalo_account_id, zalo_user_id)`.
- `thread_participants` unique key: `(thread_id, contact_id)`.
- Each thread has at most one active assignment.
- Inbound messages are unique by `(thread_id, zalo_message_id)` when a Zalo message ID exists.
- If Za-go does not provide a stable message ID, ingestion uses a deterministic fallback idempotency key from thread, sender, timestamp, and payload hash.
- Index `threads(last_message_at DESC)` for conversation list ordering.
- Index `messages(thread_id, zalo_created_at DESC)` and `messages(thread_id, created_at DESC)` for pagination.
- Index `media_assets(archive_status, retry_count)` for archive jobs.
- Index `conversation_assignments(assigned_to_user_id, status)` for agent queues.

## API And WebSocket Contract

### NestJS Modules

| Module | Responsibility |
| --- | --- |
| `AuthModule` | Internal login, logout, current user, JWT/session handling. |
| `UsersModule` | Owner/Manager/Agent management. |
| `ZaloAccountModule` | QR login, Zalo connection status, reconnect, logout. |
| `ConversationsModule` | Thread list, thread detail, assignment, archive/read actions. |
| `MessagesModule` | Text/image/file/sticker/reply/reaction/undo sending endpoints. |
| `MediaModule` | Signed media URLs and archive retry endpoints. |
| `RealtimeModule` | WebSocket gateway for clients. |
| `ConnectorModule` | Redis Streams consumers/producers for events and commands. |
| `AuditModule` | Audit logging. |
| `HealthModule` | Health checks for Docker Compose. |

### REST Endpoints

Auth and users:

- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /users`
- `POST /users`
- `PATCH /users/:id`
- `PATCH /users/:id/status`

Zalo account:

- `GET /zalo-account/status`
- `POST /zalo-account/qr/start`
- `GET /zalo-account/qr/status`
- `POST /zalo-account/reconnect`
- `POST /zalo-account/logout`

Conversations:

- `GET /conversations?status=&assignedTo=&q=&threadType=`
- `GET /conversations/:id`
- `POST /conversations/:id/assign`
- `POST /conversations/:id/release`
- `POST /conversations/:id/archive`
- `POST /conversations/:id/read`

Messages:

- `GET /conversations/:id/messages?before=&limit=`
- `POST /conversations/:id/messages`
- `POST /conversations/:id/messages/image`
- `POST /conversations/:id/messages/file`
- `POST /messages/:id/reaction`
- `POST /messages/:id/undo`
- `POST /conversations/:id/typing`

Media:

- `GET /media/:id`
- `POST /media/:id/retry-archive`

### Server-To-Client WebSocket Events

- `conversation.created`
- `conversation.updated`
- `conversation.assigned`
- `message.created`
- `message.updated`
- `message.deleted`
- `message.reaction_updated`
- `message.receipt_updated`
- `media.archive_updated`
- `typing.started`
- `typing.stopped`
- `zalo.status_updated`
- `connector.error`

### Client-To-Server WebSocket Commands

REST remains the primary path for sending messages because it is easier to audit and make idempotent. WebSocket commands are limited to transient behavior:

- `typing.start`
- `typing.stop`
- `conversation.join`
- `conversation.leave`

## Permissions And Assignment

Roles:

- `OWNER`: full access, user management, Zalo QR login/logout, all conversations.
- `MANAGER`: all conversations, assignment/release, agent oversight, no Zalo logout by default.
- `AGENT`: unassigned and self-assigned conversations, claim/release depending on policy, message sending only in allowed threads.

Assignment policy:

- Unassigned thread: Agent may claim and then send.
- Thread assigned to self: Agent may send.
- Thread assigned to another agent: Agent cannot send.
- Owner and Manager may view and send in any thread.
- Each thread has at most one active assignment in the MVP.

## Za-go Integration

The Go connector wraps Za-go behind an internal `ZaloClient` interface so the rest of the connector does not expose Za-go types directly.

Za-go public APIs expected for MVP:

- `Zalo(...)`
- `AuthQRCode()`
- `WaitQRCodeScan(...)`
- `WaitQRCodeConfirm(...)`
- `CheckQRCodeScan(...)`
- `CheckQRCodeConfirm(...)`
- `CheckQRSession(...)`
- `SetSession(sessionCookies)`
- `IsLoggedIn()`
- `Listen(thread bool, reconnect int)`
- `StopListening()`
- `IsListening()`
- `SetSocketCallbacks(...)`
- `SendMessage(...)`
- `SendImage(...)`
- `SendFile(...)`
- `SendSticker(...)`
- `SendReaction(...)`
- `UndoMessage(...)`
- `SetTyping(...)`
- `MarkAsRead(...)`
- `FetchAccountInfo()`
- `FetchUserInfo(...)`
- `FetchGroupInfo(...)`
- `FetchAllFriends()`
- `FetchAllGroups()`

Connector components:

- `SessionStore`: reads/writes encrypted session material through the API or a controlled storage path.
- `ZaloRuntime`: initializes Za-go, binds callbacks, starts/stops listen loop, reconnects.
- `EventPublisher`: publishes normalized events to `zalo.events`.
- `CommandConsumer`: consumes `zalo.commands` and invokes Za-go APIs.
- `CommandResultPublisher`: publishes command results to `zalo.events`.
- `HealthReporter`: reports connection, listening, reconnect, and error states.

Session handling:

- Owner starts QR login from the web UI.
- NestJS publishes an auth command.
- Connector calls Za-go QR APIs and emits QR/status events.
- After confirmation, connector stores encrypted session material and starts listening.
- On restart, connector loads the latest active session, calls `SetSession`, verifies login state, and resumes `Listen`.

Implementation risk:

Za-go exposes `SetSession(sessionCookies)`, but the inspected public files do not clearly expose a public session export method. During implementation, verify whether `WaitQRCodeConfirm` or related state returns enough session data. If not, patch or fork Za-go minimally to add a safe `ExportSession()` method. The rest of the system must depend on `SessionStore`, not on this detail.

Reconnect behavior:

- Session-expired/login-required errors set account status to `qr_required` and block new sends.
- Transient network errors trigger exponential backoff and reconnect.
- Connector restart attempts session restore before requiring QR login.
- Connector emits status events for `starting`, `qr_required`, `authenticated`, `listening`, `reconnecting`, `disconnected`, `session_expired`, and `error`.

## Error Handling

| Error Type | Handling |
| --- | --- |
| Session expired/login required | Stop sending/listening and show QR-required status to Owner. |
| Network timeout | Retry safe commands and reconnect listener with backoff. |
| Malformed Za-go payload | Store raw payload, mark event for inspection, keep consumer alive. |
| Send rejected by Zalo | Mark message `failed` and expose retry/manual action where safe. |
| Media download failed | Mark media `failed_retryable`, record error, retry with backoff. |
| Unknown message type | Store normalized `unknown` message plus full raw payload. |

Redis command idempotency:

- Every command has `command_id`, `message_id`, `thread_id`, `thread_type`, `command_type`, `payload`, and `created_at`.
- Connector skips terminal commands already known as succeeded/failed.
- Connector ACKs a command only after publishing its result event.
- NestJS applies command result events idempotently by `command_id`.

## Security

- Encrypt Zalo sessions/cookies before storing them.
- Never log sessions, cookies, passwords, JWT secrets, or encryption keys.
- Keep MinIO objects private; the UI accesses media through NestJS signed URLs.
- Do not expose Redis, Postgres, or MinIO public ports on the production VPS.
- Restrict QR login/logout to Owner.
- Store `.env` outside version control.
- Use audit logs for user management, assignment, Zalo account actions, and privileged operations.

## UI Modules

| UI Module | Contents |
| --- | --- |
| Login | Internal staff login. |
| Main Chat Layout | Conversation sidebar, message panel, detail/assignment drawer. |
| Conversation List | Filters for all/mine/unassigned, USER/GROUP, search. |
| Message Thread | Infinite scroll, bubbles, status, reactions, reply preview. |
| Composer | Text, image upload, file upload, sticker, reply, typing. |
| Assignment Panel | Claim, assign, release conversation. |
| Zalo Account Admin | QR login, listening status, reconnect, error display. |
| User Management | Owner/Manager user administration. |
| Media Viewer | Image/file preview and archive status. |
| Connector Status Banner | Visible warning for disconnected/reconnecting/error states. |

## Testing And Verification

Testing layers:

- Go connector unit tests for Za-go payload to internal event mapping.
- Go connector integration tests for Redis command consume/result publish.
- NestJS unit tests for permissions, assignment rules, and message status transitions.
- NestJS integration tests for Redis event consumer to PostgreSQL writes.
- Media worker tests for MinIO archive success/failure/retry.
- Frontend component tests for conversation list, message thread, and composer.
- E2E smoke tests for internal login, QR status mock, event ingestion mock, and send command mock.
- Manual Zalo tests against a real test account.

Za-go contract fixtures:

- inbound text
- inbound image
- inbound file
- sticker
- reaction
- reply
- delivered
- seen
- typing
- group message
- group system event
- socket error

MVP acceptance checks:

- Owner can login to the system.
- Owner can connect Zalo via QR.
- Connector reaches `listening` state.
- USER messages arrive realtime in UI.
- GROUP messages arrive realtime in UI.
- Agent can claim a conversation.
- Agent can send text.
- Agent can send image/file.
- Outbound messages transition through queued/sending/sent or failed.
- Delivered/seen updates appear if Za-go emits them.
- Typing appears realtime when supported.
- Media is archived into MinIO.
- Restarting `api` does not lose unprocessed Redis events.
- Restarting `zalo-connector` restores session and reconnects when the session is still valid.
- Session expiry shows a clear QR-required state.
- Agent cannot send in a thread assigned to another agent.
- Owner and Manager can view all threads.

## Docker Compose Deployment

Services:

- `web`
- `api`
- `zalo-connector`
- `media-worker`
- `postgres`
- `redis`
- `minio`
- `nginx` as an optional reverse proxy for web, API, and WebSocket traffic.

Persistent volumes:

- `postgres_data`
- `redis_data`
- `minio_data`
- `connector_data` if the connector needs device identity or temporary cache persistence.

Required environment variables:

- `DATABASE_URL`
- `REDIS_URL`
- `MINIO_ENDPOINT`
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`
- `JWT_SECRET`
- `SESSION_ENCRYPTION_KEY`
- `ZALO_USER_AGENT`
- `ZALO_IMEI`
- `PUBLIC_APP_URL`

Production VPS rules:

- Expose only `80/443` publicly.
- Keep Postgres, Redis, and MinIO on the private Docker network.
- Enable Redis AOF for stream durability.
- Back up PostgreSQL and MinIO volumes regularly.
- Do not commit `.env` or generated secrets.

## Future Phases

Phase 2:

- Multiple Zalo accounts.
- CRM tags, notes, and customer profile.
- Full-text search.
- Saved replies/templates.
- Internal notes.
- Conversation labels and SLA statuses.

Phase 3:

- Multi-tenant architecture.
- Automation and routing rules.
- Analytics and reporting.
- Deal pipeline.
- Public webhook/API.
- Horizontal scaling.
