# Zalo Chat CRM MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Docker Compose MVP for a single-business Zalo Web-style Chat+CRM with durable realtime chat, manual assignment, and media archival.

**Architecture:** Use a monorepo with `apps/api` for NestJS, `apps/web` for React, and `apps/zalo-connector` for the Go Za-go connector. Redis Streams decouple Zalo connector events/commands from NestJS persistence, PostgreSQL stores application state, and MinIO stores archived media.

**Tech Stack:** NestJS, Prisma, PostgreSQL, Redis Streams, Socket.IO, React/Vite, Go 1.22+, Za-go, MinIO, Docker Compose, Jest/Vitest, Go test.

---

## Source Spec

Implement from `docs/superpowers/specs/2026-05-08-zalo-chat-crm-mvp-design.md`.

## Repository Structure

Create this structure:

```text
apps/
  api/
    prisma/schema.prisma
    src/
      app.module.ts
      main.ts
      auth/
      users/
      conversations/
      messages/
      media/
      zalo-account/
      connector/
      realtime/
      audit/
      health/
      common/
    test/
  web/
    src/
      api/
      auth/
      chat/
      components/
      realtime/
      routes/
  zalo-connector/
    cmd/connector/main.go
    internal/config/
    internal/events/
    internal/redisstream/
    internal/runtime/
    internal/zalo/
    testdata/fixtures/
docker/
  nginx/default.conf
docs/superpowers/plans/
docs/superpowers/specs/
```

Keep boundaries strict:

- `apps/zalo-connector` never writes PostgreSQL.
- `apps/api` never imports Za-go.
- `apps/web` only talks to `apps/api`.
- Event and command names are centralized in both API and connector contract files.

## Task 1: Commit Design Baseline And Project Metadata

**Files:**

- Modify: `README.md`
- Create: `.gitignore`
- Create: `.env.example`
- Existing: `docs/superpowers/specs/2026-05-08-zalo-chat-crm-mvp-design.md`

- [ ] **Step 1: Update README**

Replace `README.md` with:

```markdown
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
```

- [ ] **Step 2: Add `.gitignore`**

Create `.gitignore`:

```gitignore
node_modules/
dist/
build/
coverage/
.env
.env.*
!.env.example
.DS_Store
.superpowers/
tmp/
*.log
apps/api/generated/
apps/api/.prisma/
apps/web/dist/
apps/zalo-connector/bin/
```

- [ ] **Step 3: Add `.env.example`**

Create `.env.example`:

```dotenv
DATABASE_URL=postgresql://zlo:zlo@postgres:5432/zlo?schema=public
REDIS_URL=redis://redis:6379
MINIO_ENDPOINT=http://minio:9000
MINIO_ACCESS_KEY=zlo_minio
MINIO_SECRET_KEY=zlo_minio_secret
MINIO_BUCKET=zlo-media
JWT_SECRET=change-me
SESSION_ENCRYPTION_KEY=replace-with-32-byte-base64-key
ZALO_USER_AGENT=Mozilla/5.0 Zlo-Go
ZALO_IMEI=replace-with-stable-imei
PUBLIC_APP_URL=http://localhost:8080
API_PORT=3000
WEB_PORT=5173
```

- [ ] **Step 4: Verify git status**

Run: `git status --short`

Expected includes:

```text
?? .env.example
?? .gitignore
?? docs/
 M README.md
```

- [ ] **Step 5: Commit**

Run:

```bash
git add README.md .gitignore .env.example docs/superpowers/specs/2026-05-08-zalo-chat-crm-mvp-design.md docs/superpowers/plans/2026-05-08-zalo-chat-crm-mvp.md
git commit -m "docs: add Zalo chat CRM MVP design and plan"
```

Expected: commit succeeds. Do not push unless explicitly requested.

## Task 2: Scaffold Docker Compose Infrastructure

**Files:**

- Create: `docker-compose.yml`
- Create: `docker/nginx/default.conf`

- [ ] **Step 1: Write `docker-compose.yml`**

Create `docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: zlo
      POSTGRES_USER: zlo
      POSTGRES_PASSWORD: zlo
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U zlo -d zlo"]
      interval: 5s
      timeout: 5s
      retries: 20

  redis:
    image: redis:7-alpine
    command: ["redis-server", "--appendonly", "yes"]
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 20

  minio:
    image: minio/minio:RELEASE.2025-04-22T22-12-26Z
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: zlo_minio
      MINIO_ROOT_PASSWORD: zlo_minio_secret
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 10s
      timeout: 5s
      retries: 20

  api:
    build:
      context: ./apps/api
    env_file: .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      minio:
        condition: service_started
    ports:
      - "3000:3000"

  web:
    build:
      context: ./apps/web
    ports:
      - "5173:80"
    depends_on:
      - api

  zalo-connector:
    build:
      context: ./apps/zalo-connector
    env_file: .env
    depends_on:
      redis:
        condition: service_healthy
    volumes:
      - connector_data:/data

  nginx:
    image: nginx:1.27-alpine
    ports:
      - "8080:80"
    volumes:
      - ./docker/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - api
      - web

volumes:
  postgres_data:
  redis_data:
  minio_data:
  connector_data:
```

- [ ] **Step 2: Write nginx config**

Create `docker/nginx/default.conf`:

```nginx
server {
  listen 80;

  location /api/ {
    proxy_pass http://api:3000/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }

  location /socket.io/ {
    proxy_pass http://api:3000/socket.io/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
  }

  location / {
    proxy_pass http://web:80/;
  }
}
```

- [ ] **Step 3: Verify compose config**

Run: `docker compose config`

Expected: config renders without YAML errors. It may warn if `.env` is missing.

- [ ] **Step 4: Commit**

Run:

```bash
git add docker-compose.yml docker/nginx/default.conf
git commit -m "chore: add Docker Compose infrastructure"
```

## Task 3: Scaffold NestJS API With Health Check

**Files:**

- Create under: `apps/api/`
- Create: `apps/api/package.json`
- Create: `apps/api/Dockerfile`
- Create: `apps/api/src/main.ts`
- Create: `apps/api/src/app.module.ts`
- Create: `apps/api/src/health/health.controller.ts`
- Create: `apps/api/src/health/health.module.ts`
- Test: `apps/api/src/health/health.controller.spec.ts`

- [ ] **Step 1: Create API package files**

Create `apps/api/package.json`:

```json
{
  "name": "zlo-api",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "start": "nest start",
    "start:dev": "nest start --watch",
    "build": "nest build",
    "test": "jest --runInBand",
    "test:watch": "jest --watch",
    "lint": "eslint \"src/**/*.ts\"",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev"
  },
  "dependencies": {
    "@nestjs/common": "^10.4.19",
    "@nestjs/core": "^10.4.19",
    "@nestjs/platform-express": "^10.4.19",
    "@nestjs/websockets": "^10.4.19",
    "@nestjs/platform-socket.io": "^10.4.19",
    "@prisma/client": "^5.22.0",
    "ioredis": "^5.4.1",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "socket.io": "^4.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.4.9",
    "@nestjs/schematics": "^10.2.3",
    "@nestjs/testing": "^10.4.19",
    "@types/jest": "^29.5.14",
    "@types/node": "^22.15.3",
    "jest": "^29.7.0",
    "prisma": "^5.22.0",
    "ts-jest": "^29.3.2",
    "ts-node": "^10.9.2",
    "typescript": "^5.8.3"
  },
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": {"^.+\\.(t|j)s$": "ts-jest"},
    "testEnvironment": "node"
  }
}
```

Create `apps/api/tsconfig.json`:

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2022",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "strict": true,
    "skipLibCheck": true
  }
}
```

Create `apps/api/nest-cli.json`:

```json
{"collection":"@nestjs/schematics","sourceRoot":"src"}
```

- [ ] **Step 2: Write failing health test**

Create `apps/api/src/health/health.controller.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns ok status', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    const controller = moduleRef.get(HealthController);

    expect(controller.check()).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 3: Run test and verify it fails**

Run: `npm install; npm test -- health.controller.spec.ts` in `apps/api`.

Expected: FAIL because `health.controller.ts` does not exist.

- [ ] **Step 4: Implement health module**

Create `apps/api/src/health/health.controller.ts`:

```ts
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
```

Create `apps/api/src/health/health.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({ controllers: [HealthController] })
export class HealthModule {}
```

Create `apps/api/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';

@Module({ imports: [HealthModule] })
export class AppModule {}
```

Create `apps/api/src/main.ts`:

```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true, credentials: true });
  await app.listen(process.env.API_PORT ? Number(process.env.API_PORT) : 3000);
}

void bootstrap();
```

Create `apps/api/Dockerfile`:

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./
CMD ["node", "dist/main.js"]
```

- [ ] **Step 5: Run tests**

Run: `npm test` in `apps/api`.

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/api
git commit -m "feat(api): scaffold NestJS health service"
```

## Task 4: Add Prisma Data Model And Database Module

**Files:**

- Create: `apps/api/prisma/schema.prisma`
- Create: `apps/api/src/common/prisma/prisma.service.ts`
- Create: `apps/api/src/common/prisma/prisma.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/src/common/prisma/prisma.service.spec.ts`

- [ ] **Step 1: Write Prisma schema**

Create `apps/api/prisma/schema.prisma` with enums and models from the spec:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole { OWNER MANAGER AGENT }
enum UserStatus { active disabled }
enum ZaloAccountStatus { disconnected qr_required connecting listening error }
enum ThreadType { USER GROUP }
enum ThreadStatus { open archived }
enum AssignmentStatus { active released }
enum MessageDirection { inbound outbound }
enum MessageType { text image file sticker system reaction unknown }
enum MessageStatus { received queued sending sent delivered seen failed deleted }
enum MediaType { image file sticker voice video unknown }
enum ArchiveStatus { pending archived failed_retryable failed_permanent }
enum CommandStatus { queued processing succeeded failed }

model User {
  id           String     @id @default(uuid())
  email        String     @unique
  passwordHash String     @map("password_hash")
  displayName  String     @map("display_name")
  role         UserRole
  status       UserStatus @default(active)
  createdAt    DateTime   @default(now()) @map("created_at")
  updatedAt    DateTime   @updatedAt @map("updated_at")
  assignedConversations ConversationAssignment[] @relation("AssignedTo")
  assignedByConversations ConversationAssignment[] @relation("AssignedBy")
  outboundMessages Message[]
  outboundCommands OutboundCommand[]
  auditLogs AuditLog[]

  @@map("users")
}

model ZaloAccount {
  id              String            @id @default(uuid())
  displayName     String?           @map("display_name")
  zaloUserId      String?           @map("zalo_user_id")
  zaloClientId    String?           @map("zalo_client_id")
  phoneMasked     String?           @map("phone_masked")
  status          ZaloAccountStatus @default(disconnected)
  lastConnectedAt DateTime?         @map("last_connected_at")
  createdAt       DateTime          @default(now()) @map("created_at")
  updatedAt       DateTime          @updatedAt @map("updated_at")
  sessions        ZaloSession[]
  contacts        Contact[]
  threads         Thread[]

  @@map("zalo_accounts")
}

model ZaloSession {
  id            String      @id @default(uuid())
  zaloAccountId String      @map("zalo_account_id")
  encryptedData String      @map("encrypted_data")
  active        Boolean     @default(true)
  createdAt     DateTime    @default(now()) @map("created_at")
  updatedAt     DateTime    @updatedAt @map("updated_at")
  zaloAccount   ZaloAccount @relation(fields: [zaloAccountId], references: [id])

  @@index([zaloAccountId, active])
  @@map("zalo_sessions")
}

model Contact {
  id            String      @id @default(uuid())
  zaloAccountId String      @map("zalo_account_id")
  zaloUserId    String      @map("zalo_user_id")
  displayName   String?     @map("display_name")
  avatarUrl     String?     @map("avatar_url")
  phone         String?
  rawProfile    Json?       @map("raw_profile")
  createdAt     DateTime    @default(now()) @map("created_at")
  updatedAt     DateTime    @updatedAt @map("updated_at")
  zaloAccount   ZaloAccount @relation(fields: [zaloAccountId], references: [id])
  participations ThreadParticipant[]
  sentMessages Message[]

  @@unique([zaloAccountId, zaloUserId])
  @@map("contacts")
}

model Thread {
  id             String      @id @default(uuid())
  zaloAccountId  String      @map("zalo_account_id")
  zaloThreadId   String      @map("zalo_thread_id")
  threadType     ThreadType  @map("thread_type")
  displayName    String?     @map("display_name")
  avatarUrl      String?     @map("avatar_url")
  lastMessageId  String?     @map("last_message_id")
  lastMessageAt  DateTime?   @map("last_message_at")
  unreadCount    Int         @default(0) @map("unread_count")
  status         ThreadStatus @default(open)
  createdAt      DateTime    @default(now()) @map("created_at")
  updatedAt      DateTime    @updatedAt @map("updated_at")
  zaloAccount    ZaloAccount @relation(fields: [zaloAccountId], references: [id])
  participants   ThreadParticipant[]
  assignments    ConversationAssignment[]
  messages       Message[]

  @@unique([zaloAccountId, zaloThreadId, threadType])
  @@index([lastMessageAt])
  @@map("threads")
}

model ThreadParticipant {
  id           String   @id @default(uuid())
  threadId     String   @map("thread_id")
  contactId    String   @map("contact_id")
  roleInThread String?  @map("role_in_thread")
  joinedAt     DateTime? @map("joined_at")
  leftAt       DateTime? @map("left_at")
  thread       Thread   @relation(fields: [threadId], references: [id])
  contact      Contact  @relation(fields: [contactId], references: [id])

  @@unique([threadId, contactId])
  @@map("thread_participants")
}

model ConversationAssignment {
  id               String           @id @default(uuid())
  threadId         String           @map("thread_id")
  assignedToUserId String           @map("assigned_to_user_id")
  assignedByUserId String           @map("assigned_by_user_id")
  status           AssignmentStatus @default(active)
  createdAt        DateTime         @default(now()) @map("created_at")
  releasedAt       DateTime?        @map("released_at")
  thread           Thread           @relation(fields: [threadId], references: [id])
  assignedTo       User             @relation("AssignedTo", fields: [assignedToUserId], references: [id])
  assignedBy       User             @relation("AssignedBy", fields: [assignedByUserId], references: [id])

  @@index([assignedToUserId, status])
  @@map("conversation_assignments")
}

model Message {
  id                  String           @id @default(uuid())
  threadId            String           @map("thread_id")
  zaloMessageId       String?          @map("zalo_message_id")
  zaloClientMessageId String?          @map("zalo_client_message_id")
  fallbackKey         String?          @map("fallback_key")
  senderContactId     String?          @map("sender_contact_id")
  senderUserId        String?          @map("sender_user_id")
  direction           MessageDirection
  messageType         MessageType      @map("message_type")
  text                String?
  replyToMessageId    String?          @map("reply_to_message_id")
  status              MessageStatus
  zaloCreatedAt       DateTime?        @map("zalo_created_at")
  createdAt           DateTime         @default(now()) @map("created_at")
  updatedAt           DateTime         @updatedAt @map("updated_at")
  thread              Thread           @relation(fields: [threadId], references: [id])
  senderContact       Contact?         @relation(fields: [senderContactId], references: [id])
  senderUser          User?            @relation(fields: [senderUserId], references: [id])
  rawPayloads         MessageRawPayload[]
  receipts            MessageReceipt[]
  reactions           MessageReaction[]
  mediaAssets         MediaAsset[]
  outboundCommands    OutboundCommand[]

  @@unique([threadId, zaloMessageId])
  @@unique([threadId, fallbackKey])
  @@index([threadId, zaloCreatedAt])
  @@index([threadId, createdAt])
  @@map("messages")
}

model MessageRawPayload {
  id        String   @id @default(uuid())
  messageId String   @map("message_id")
  source    String
  payload   Json
  createdAt DateTime @default(now()) @map("created_at")
  message   Message  @relation(fields: [messageId], references: [id])

  @@map("message_raw_payloads")
}

model MessageReceipt {
  id        String   @id @default(uuid())
  messageId String   @map("message_id")
  type      String
  actorId   String?  @map("actor_id")
  timestamp DateTime
  message   Message  @relation(fields: [messageId], references: [id])

  @@index([messageId, type])
  @@map("message_receipts")
}

model MessageReaction {
  id        String   @id @default(uuid())
  messageId String   @map("message_id")
  actorId   String?  @map("actor_id")
  reaction  String
  createdAt DateTime @default(now()) @map("created_at")
  message   Message  @relation(fields: [messageId], references: [id])

  @@map("message_reactions")
}

model MediaAsset {
  id            String        @id @default(uuid())
  messageId     String        @map("message_id")
  mediaType     MediaType     @map("media_type")
  sourceUrl     String?       @map("source_url")
  storageBucket String?       @map("storage_bucket")
  storageKey    String?       @map("storage_key")
  fileName      String?       @map("file_name")
  mimeType      String?       @map("mime_type")
  sizeBytes     BigInt?       @map("size_bytes")
  checksum      String?
  archiveStatus ArchiveStatus @default(pending) @map("archive_status")
  retryCount    Int           @default(0) @map("retry_count")
  lastError     String?       @map("last_error")
  createdAt     DateTime      @default(now()) @map("created_at")
  updatedAt     DateTime      @updatedAt @map("updated_at")
  message       Message       @relation(fields: [messageId], references: [id])

  @@index([archiveStatus, retryCount])
  @@map("media_assets")
}

model OutboundCommand {
  id              String        @id @default(uuid())
  threadId        String        @map("thread_id")
  messageId       String?       @map("message_id")
  commandType     String        @map("command_type")
  payload         Json
  status          CommandStatus @default(queued)
  error           String?
  createdByUserId String        @map("created_by_user_id")
  createdAt       DateTime      @default(now()) @map("created_at")
  updatedAt       DateTime      @updatedAt @map("updated_at")
  message         Message?      @relation(fields: [messageId], references: [id])
  createdBy       User          @relation(fields: [createdByUserId], references: [id])

  @@map("outbound_commands")
}

model ConnectorEvent {
  id        String   @id @default(uuid())
  type      String
  payload   Json
  createdAt DateTime @default(now()) @map("created_at")

  @@index([createdAt])
  @@map("connector_events")
}

model AuditLog {
  id        String   @id @default(uuid())
  userId    String?  @map("user_id")
  action    String
  target    String?
  payload   Json?
  createdAt DateTime @default(now()) @map("created_at")
  user      User?    @relation(fields: [userId], references: [id])

  @@map("audit_logs")
}
```

- [ ] **Step 2: Write Prisma service test**

Create `apps/api/src/common/prisma/prisma.service.spec.ts`:

```ts
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  it('constructs with Prisma client methods', () => {
    const service = new PrismaService();
    expect(typeof service.$connect).toBe('function');
    expect(typeof service.$disconnect).toBe('function');
  });
});
```

- [ ] **Step 3: Run test and verify it fails**

Run: `npm test -- prisma.service.spec.ts` in `apps/api`.

Expected: FAIL because `prisma.service.ts` does not exist.

- [ ] **Step 4: Implement Prisma module**

Create `apps/api/src/common/prisma/prisma.service.ts`:

```ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
```

Create `apps/api/src/common/prisma/prisma.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
```

Update `apps/api/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { PrismaModule } from './common/prisma/prisma.module';
import { HealthModule } from './health/health.module';

@Module({ imports: [PrismaModule, HealthModule] })
export class AppModule {}
```

- [ ] **Step 5: Generate Prisma client and test**

Run: `npm run prisma:generate; npm test` in `apps/api`.

Expected: Prisma client generates and tests PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/api
git commit -m "feat(api): add Prisma data model"
```

## Task 5: Add Redis Stream Contract In API

**Files:**

- Create: `apps/api/src/connector/stream-names.ts`
- Create: `apps/api/src/connector/events.ts`
- Create: `apps/api/src/connector/redis-stream.service.ts`
- Create: `apps/api/src/connector/connector.module.ts`
- Test: `apps/api/src/connector/events.spec.ts`

- [ ] **Step 1: Write contract test**

Create `apps/api/src/connector/events.spec.ts`:

```ts
import { ZALO_COMMANDS_STREAM, ZALO_EVENTS_STREAM } from './stream-names';
import { createSendTextCommand } from './events';

describe('connector event contract', () => {
  it('uses stable stream names', () => {
    expect(ZALO_EVENTS_STREAM).toBe('zalo.events');
    expect(ZALO_COMMANDS_STREAM).toBe('zalo.commands');
  });

  it('creates send text command payload', () => {
    expect(createSendTextCommand({
      commandId: 'cmd-1',
      messageId: 'msg-1',
      threadId: 'thread-1',
      threadType: 'USER',
      text: 'hello',
    })).toEqual({
      type: 'command.send_text',
      command_id: 'cmd-1',
      message_id: 'msg-1',
      thread_id: 'thread-1',
      thread_type: 'USER',
      payload: { text: 'hello' },
    });
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npm test -- events.spec.ts` in `apps/api`.

Expected: FAIL because contract files do not exist.

- [ ] **Step 3: Implement contracts**

Create `apps/api/src/connector/stream-names.ts`:

```ts
export const ZALO_EVENTS_STREAM = 'zalo.events';
export const ZALO_COMMANDS_STREAM = 'zalo.commands';
export const MEDIA_JOBS_STREAM = 'media.jobs';
```

Create `apps/api/src/connector/events.ts`:

```ts
export type ThreadType = 'USER' | 'GROUP';

export type SendTextCommandInput = {
  commandId: string;
  messageId: string;
  threadId: string;
  threadType: ThreadType;
  text: string;
};

export function createSendTextCommand(input: SendTextCommandInput) {
  return {
    type: 'command.send_text' as const,
    command_id: input.commandId,
    message_id: input.messageId,
    thread_id: input.threadId,
    thread_type: input.threadType,
    payload: { text: input.text },
  };
}
```

Create `apps/api/src/connector/redis-stream.service.ts`:

```ts
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisStreamService implements OnModuleDestroy {
  private readonly redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

  async publish(stream: string, event: Record<string, unknown>): Promise<string> {
    return this.redis.xadd(stream, '*', 'event', JSON.stringify(event));
  }

  async onModuleDestroy(): Promise<void> {
    this.redis.disconnect();
  }
}
```

Create `apps/api/src/connector/connector.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { RedisStreamService } from './redis-stream.service';

@Module({ providers: [RedisStreamService], exports: [RedisStreamService] })
export class ConnectorModule {}
```

Update `apps/api/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { PrismaModule } from './common/prisma/prisma.module';
import { ConnectorModule } from './connector/connector.module';
import { HealthModule } from './health/health.module';

@Module({ imports: [PrismaModule, ConnectorModule, HealthModule] })
export class AppModule {}
```

- [ ] **Step 4: Run tests**

Run: `npm test` in `apps/api`.

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/api
git commit -m "feat(api): add Redis stream contract"
```

## Task 6: Implement Assignment Policy In API

**Files:**

- Create: `apps/api/src/conversations/assignment-policy.ts`
- Test: `apps/api/src/conversations/assignment-policy.spec.ts`

- [ ] **Step 1: Write failing policy tests**

Create `apps/api/src/conversations/assignment-policy.spec.ts`:

```ts
import { canSendInConversation } from './assignment-policy';

describe('canSendInConversation', () => {
  it('allows owner in any thread', () => {
    expect(canSendInConversation({ role: 'OWNER', userId: 'owner', assignedToUserId: 'agent-1' })).toBe(true);
  });

  it('allows manager in any thread', () => {
    expect(canSendInConversation({ role: 'MANAGER', userId: 'manager', assignedToUserId: 'agent-1' })).toBe(true);
  });

  it('allows agent in unassigned thread', () => {
    expect(canSendInConversation({ role: 'AGENT', userId: 'agent-1', assignedToUserId: null })).toBe(true);
  });

  it('allows agent assigned to self', () => {
    expect(canSendInConversation({ role: 'AGENT', userId: 'agent-1', assignedToUserId: 'agent-1' })).toBe(true);
  });

  it('blocks agent assigned to another agent', () => {
    expect(canSendInConversation({ role: 'AGENT', userId: 'agent-1', assignedToUserId: 'agent-2' })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npm test -- assignment-policy.spec.ts` in `apps/api`.

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement policy**

Create `apps/api/src/conversations/assignment-policy.ts`:

```ts
export type Role = 'OWNER' | 'MANAGER' | 'AGENT';

export type SendPolicyInput = {
  role: Role;
  userId: string;
  assignedToUserId: string | null;
};

export function canSendInConversation(input: SendPolicyInput): boolean {
  if (input.role === 'OWNER' || input.role === 'MANAGER') {
    return true;
  }

  if (input.assignedToUserId === null) {
    return true;
  }

  return input.assignedToUserId === input.userId;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test` in `apps/api`.

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/api/src/conversations
git commit -m "feat(api): add conversation assignment policy"
```

## Task 7: Implement Message Send Command Service

**Files:**

- Create: `apps/api/src/messages/messages.service.ts`
- Create: `apps/api/src/messages/messages.module.ts`
- Test: `apps/api/src/messages/messages.service.spec.ts`

- [ ] **Step 1: Write failing service test**

Create `apps/api/src/messages/messages.service.spec.ts`:

```ts
import { MessagesService } from './messages.service';
import { RedisStreamService } from '../connector/redis-stream.service';

describe('MessagesService', () => {
  it('publishes send text command and returns queued message id', async () => {
    const published: Array<{ stream: string; event: Record<string, unknown> }> = [];
    const redis = { publish: async (stream: string, event: Record<string, unknown>) => {
      published.push({ stream, event });
      return '1-0';
    }} as RedisStreamService;

    const service = new MessagesService(redis);
    const result = await service.queueTextMessage({
      threadId: 'thread-1',
      threadType: 'USER',
      text: 'hello',
    });

    expect(result.status).toBe('queued');
    expect(published).toHaveLength(1);
    expect(published[0]?.stream).toBe('zalo.commands');
    expect(published[0]?.event).toMatchObject({
      type: 'command.send_text',
      thread_id: 'thread-1',
      thread_type: 'USER',
      payload: { text: 'hello' },
    });
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npm test -- messages.service.spec.ts` in `apps/api`.

Expected: FAIL because service does not exist.

- [ ] **Step 3: Implement service**

Create `apps/api/src/messages/messages.service.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ZALO_COMMANDS_STREAM } from '../connector/stream-names';
import { createSendTextCommand, ThreadType } from '../connector/events';
import { RedisStreamService } from '../connector/redis-stream.service';

export type QueueTextMessageInput = {
  threadId: string;
  threadType: ThreadType;
  text: string;
};

@Injectable()
export class MessagesService {
  constructor(private readonly redisStream: RedisStreamService) {}

  async queueTextMessage(input: QueueTextMessageInput): Promise<{ messageId: string; commandId: string; status: 'queued' }> {
    const messageId = randomUUID();
    const commandId = randomUUID();

    await this.redisStream.publish(ZALO_COMMANDS_STREAM, createSendTextCommand({
      commandId,
      messageId,
      threadId: input.threadId,
      threadType: input.threadType,
      text: input.text,
    }));

    return { messageId, commandId, status: 'queued' };
  }
}
```

Create `apps/api/src/messages/messages.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ConnectorModule } from '../connector/connector.module';
import { MessagesService } from './messages.service';

@Module({ imports: [ConnectorModule], providers: [MessagesService], exports: [MessagesService] })
export class MessagesModule {}
```

Update `apps/api/src/app.module.ts` to include `MessagesModule`.

- [ ] **Step 4: Run tests**

Run: `npm test` in `apps/api`.

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/api/src/messages apps/api/src/app.module.ts
git commit -m "feat(api): queue outbound text commands"
```

## Task 8: Scaffold Go Zalo Connector With Event Contracts

**Files:**

- Create: `apps/zalo-connector/go.mod`
- Create: `apps/zalo-connector/Dockerfile`
- Create: `apps/zalo-connector/cmd/connector/main.go`
- Create: `apps/zalo-connector/internal/events/events.go`
- Test: `apps/zalo-connector/internal/events/events_test.go`

- [ ] **Step 1: Create Go module**

Create `apps/zalo-connector/go.mod`:

```go
module github.com/royzxje/zlo-go/apps/zalo-connector

go 1.22

require github.com/redis/go-redis/v9 v9.7.0
```

- [ ] **Step 2: Write failing event test**

Create `apps/zalo-connector/internal/events/events_test.go`:

```go
package events

import "testing"

func TestSendSucceededEvent(t *testing.T) {
 event := NewSendSucceeded("cmd-1", "msg-1", "zalo-msg-1")
 if event.Type != "message.send_succeeded" {
  t.Fatalf("expected message.send_succeeded, got %s", event.Type)
 }
 if event.CommandID != "cmd-1" || event.MessageID != "msg-1" || event.ZaloMessageID != "zalo-msg-1" {
  t.Fatalf("unexpected event: %#v", event)
 }
}
```

- [ ] **Step 3: Run test and verify it fails**

Run: `go test ./...` in `apps/zalo-connector`.

Expected: FAIL because `events.go` does not exist.

- [ ] **Step 4: Implement event contract and main**

Create `apps/zalo-connector/internal/events/events.go`:

```go
package events

type SendSucceededEvent struct {
 Type          string `json:"type"`
 CommandID     string `json:"command_id"`
 MessageID     string `json:"message_id"`
 ZaloMessageID string `json:"zalo_message_id"`
}

func NewSendSucceeded(commandID string, messageID string, zaloMessageID string) SendSucceededEvent {
 return SendSucceededEvent{
  Type:          "message.send_succeeded",
  CommandID:     commandID,
  MessageID:     messageID,
  ZaloMessageID: zaloMessageID,
 }
}
```

Create `apps/zalo-connector/cmd/connector/main.go`:

```go
package main

import "log"

func main() {
 log.Println("zalo connector starting")
}
```

Create `apps/zalo-connector/Dockerfile`:

```dockerfile
FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN go build -o /out/zalo-connector ./cmd/connector

FROM alpine:3.20
WORKDIR /app
COPY --from=build /out/zalo-connector /app/zalo-connector
CMD ["/app/zalo-connector"]
```

- [ ] **Step 5: Run tests**

Run: `go test ./...` in `apps/zalo-connector`.

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/zalo-connector
git commit -m "feat(connector): scaffold Go service contracts"
```

## Task 9: Implement Connector Redis Command Loop With Mock Zalo Client

**Files:**

- Create: `apps/zalo-connector/internal/zalo/client.go`
- Create: `apps/zalo-connector/internal/runtime/command_handler.go`
- Test: `apps/zalo-connector/internal/runtime/command_handler_test.go`

- [ ] **Step 1: Write failing command handler test**

Create `apps/zalo-connector/internal/runtime/command_handler_test.go`:

```go
package runtime

import (
 "context"
 "testing"
)

type fakeZalo struct{ sentText string }

func (f *fakeZalo) SendText(ctx context.Context, threadID string, threadType string, text string) (string, error) {
 f.sentText = text
 return "zalo-msg-1", nil
}

func TestHandleSendTextCommand(t *testing.T) {
 client := &fakeZalo{}
 handler := NewCommandHandler(client)
 event, err := handler.Handle(context.Background(), Command{
  Type: "command.send_text",
  CommandID: "cmd-1",
  MessageID: "msg-1",
  ThreadID: "thread-1",
  ThreadType: "USER",
  Payload: map[string]any{"text": "hello"},
 })
 if err != nil { t.Fatal(err) }
 if client.sentText != "hello" { t.Fatalf("expected sent text hello, got %s", client.sentText) }
 if event.Type != "message.send_succeeded" { t.Fatalf("unexpected event %#v", event) }
}
```

- [ ] **Step 2: Run test and verify it fails**

Run: `go test ./...` in `apps/zalo-connector`.

Expected: FAIL because runtime command handler does not exist.

- [ ] **Step 3: Implement handler**

Create `apps/zalo-connector/internal/zalo/client.go`:

```go
package zalo

import "context"

type Client interface {
 SendText(ctx context.Context, threadID string, threadType string, text string) (string, error)
}
```

Create `apps/zalo-connector/internal/runtime/command_handler.go`:

```go
package runtime

import (
 "context"
 "fmt"

 "github.com/royzxje/zlo-go/apps/zalo-connector/internal/events"
 "github.com/royzxje/zlo-go/apps/zalo-connector/internal/zalo"
)

type Command struct {
 Type       string         `json:"type"`
 CommandID  string         `json:"command_id"`
 MessageID  string         `json:"message_id"`
 ThreadID   string         `json:"thread_id"`
 ThreadType string         `json:"thread_type"`
 Payload    map[string]any `json:"payload"`
}

type CommandHandler struct { client zalo.Client }

func NewCommandHandler(client zalo.Client) *CommandHandler { return &CommandHandler{client: client} }

func (h *CommandHandler) Handle(ctx context.Context, command Command) (events.SendSucceededEvent, error) {
 if command.Type != "command.send_text" {
  return events.SendSucceededEvent{}, fmt.Errorf("unsupported command type %s", command.Type)
 }
 text, ok := command.Payload["text"].(string)
 if !ok || text == "" {
  return events.SendSucceededEvent{}, fmt.Errorf("text payload is required")
 }
 zaloMessageID, err := h.client.SendText(ctx, command.ThreadID, command.ThreadType, text)
 if err != nil {
  return events.SendSucceededEvent{}, err
 }
 return events.NewSendSucceeded(command.CommandID, command.MessageID, zaloMessageID), nil
}
```

- [ ] **Step 4: Run tests**

Run: `go test ./...` in `apps/zalo-connector`.

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/zalo-connector
git commit -m "feat(connector): handle outbound text commands"
```

## Task 10: Implement Zalo Event Ingestion In API

**Files:**

- Create: `apps/api/src/connector/zalo-event-ingestor.service.ts`
- Test: `apps/api/src/connector/zalo-event-ingestor.service.spec.ts`

- [ ] **Step 1: Write failing ingestor test**

Create `apps/api/src/connector/zalo-event-ingestor.service.spec.ts`:

```ts
import { ZaloEventIngestorService } from './zalo-event-ingestor.service';

describe('ZaloEventIngestorService', () => {
  it('maps send success to sent message update', async () => {
    const updates: Array<Record<string, unknown>> = [];
    const prisma = {
      message: {
        update: async (args: Record<string, unknown>) => updates.push(args),
      },
    };
    const service = new ZaloEventIngestorService(prisma as never);

    await service.ingest({
      type: 'message.send_succeeded',
      message_id: 'msg-1',
      zalo_message_id: 'zalo-msg-1',
    });

    expect(updates[0]).toEqual({
      where: { id: 'msg-1' },
      data: { status: 'sent', zaloMessageId: 'zalo-msg-1' },
    });
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npm test -- zalo-event-ingestor.service.spec.ts` in `apps/api`.

Expected: FAIL because service does not exist.

- [ ] **Step 3: Implement ingestor**

Create `apps/api/src/connector/zalo-event-ingestor.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

type ZaloEvent = {
  type: string;
  message_id?: string;
  zalo_message_id?: string;
};

@Injectable()
export class ZaloEventIngestorService {
  constructor(private readonly prisma: Pick<PrismaService, 'message'>) {}

  async ingest(event: ZaloEvent): Promise<void> {
    if (event.type === 'message.send_succeeded' && event.message_id && event.zalo_message_id) {
      await this.prisma.message.update({
        where: { id: event.message_id },
        data: { status: 'sent', zaloMessageId: event.zalo_message_id },
      });
    }
  }
}
```

Update `apps/api/src/connector/connector.module.ts` to provide/export `ZaloEventIngestorService`.

- [ ] **Step 4: Run tests**

Run: `npm test` in `apps/api`.

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/api/src/connector
git commit -m "feat(api): ingest Zalo command result events"
```

## Task 11: Implement Media Archive Worker Skeleton

**Files:**

- Create: `apps/api/src/media/media-archive.service.ts`
- Create: `apps/api/src/media/media.module.ts`
- Test: `apps/api/src/media/media-archive.service.spec.ts`

- [ ] **Step 1: Write failing archive status test**

Create `apps/api/src/media/media-archive.service.spec.ts`:

```ts
import { MediaArchiveService } from './media-archive.service';

describe('MediaArchiveService', () => {
  it('marks media failed_retryable when source URL is missing', async () => {
    const updates: Array<Record<string, unknown>> = [];
    const prisma = {
      mediaAsset: {
        update: async (args: Record<string, unknown>) => updates.push(args),
      },
    };
    const service = new MediaArchiveService(prisma as never);
    await service.archive({ id: 'media-1', sourceUrl: null });
    expect(updates[0]).toEqual({
      where: { id: 'media-1' },
      data: { archiveStatus: 'failed_retryable', lastError: 'source_url_missing', retryCount: { increment: 1 } },
    });
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npm test -- media-archive.service.spec.ts` in `apps/api`.

Expected: FAIL because service does not exist.

- [ ] **Step 3: Implement archive skeleton**

Create `apps/api/src/media/media-archive.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

type ArchiveInput = { id: string; sourceUrl: string | null };

@Injectable()
export class MediaArchiveService {
  constructor(private readonly prisma: Pick<PrismaService, 'mediaAsset'>) {}

  async archive(input: ArchiveInput): Promise<void> {
    if (!input.sourceUrl) {
      await this.prisma.mediaAsset.update({
        where: { id: input.id },
        data: { archiveStatus: 'failed_retryable', lastError: 'source_url_missing', retryCount: { increment: 1 } },
      });
      return;
    }

    await this.prisma.mediaAsset.update({
      where: { id: input.id },
      data: { archiveStatus: 'archived' },
    });
  }
}
```

Create `apps/api/src/media/media.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { MediaArchiveService } from './media-archive.service';

@Module({ providers: [MediaArchiveService], exports: [MediaArchiveService] })
export class MediaModule {}
```

- [ ] **Step 4: Run tests**

Run: `npm test` in `apps/api`.

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/api/src/media
git commit -m "feat(api): add media archive worker skeleton"
```

## Task 12: Scaffold React Web Chat UI

**Files:**

- Create under: `apps/web/`
- Create: `apps/web/package.json`
- Create: `apps/web/Dockerfile`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/chat/ChatLayout.tsx`
- Test: `apps/web/src/chat/ChatLayout.test.tsx`

- [ ] **Step 1: Create web package**

Create `apps/web/package.json`:

```json
{
  "name": "zlo-web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "tsc && vite build",
    "test": "vitest run",
    "preview": "vite preview"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^4.4.1",
    "vite": "^6.3.4",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "socket.io-client": "^4.8.1"
  },
  "devDependencies": {
    "@testing-library/react": "^16.3.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@types/react": "^19.1.2",
    "@types/react-dom": "^19.1.2",
    "jsdom": "^26.1.0",
    "typescript": "^5.8.3",
    "vitest": "^3.1.2"
  }
}
```

Create `apps/web/tsconfig.json`, `apps/web/index.html`, and `apps/web/vite.config.ts` with standard Vite React settings.

- [ ] **Step 2: Write failing layout test**

Create `apps/web/src/chat/ChatLayout.test.tsx`:

```tsx
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { ChatLayout } from './ChatLayout';

it('renders core chat regions', () => {
  render(<ChatLayout />);
  expect(screen.getByText('Conversations')).toBeInTheDocument();
  expect(screen.getByText('Select a conversation')).toBeInTheDocument();
  expect(screen.getByText('Zalo disconnected')).toBeInTheDocument();
});
```

- [ ] **Step 3: Run test and verify it fails**

Run: `npm install; npm test` in `apps/web`.

Expected: FAIL because `ChatLayout` does not exist.

- [ ] **Step 4: Implement layout**

Create `apps/web/src/chat/ChatLayout.tsx`:

```tsx
export function ChatLayout() {
  return (
    <main style={{ display: 'grid', gridTemplateColumns: '320px 1fr', minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <aside style={{ borderRight: '1px solid #e5e7eb', padding: 16 }}>
        <strong>Conversations</strong>
        <p>All / Mine / Unassigned</p>
      </aside>
      <section style={{ display: 'grid', gridTemplateRows: 'auto 1fr auto' }}>
        <div style={{ background: '#fff7ed', color: '#9a3412', padding: 12 }}>Zalo disconnected</div>
        <div style={{ display: 'grid', placeItems: 'center', color: '#64748b' }}>Select a conversation</div>
        <form style={{ borderTop: '1px solid #e5e7eb', padding: 16 }}>
          <input aria-label="Message" placeholder="Type a message" style={{ width: '100%', padding: 12 }} />
        </form>
      </section>
    </main>
  );
}
```

Create `apps/web/src/App.tsx`:

```tsx
import { ChatLayout } from './chat/ChatLayout';

export default function App() {
  return <ChatLayout />;
}
```

Create `apps/web/src/main.tsx`:

```tsx
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(<App />);
```

Create `apps/web/Dockerfile`:

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
```

- [ ] **Step 5: Run tests and build**

Run: `npm test; npm run build` in `apps/web`.

Expected: tests PASS and Vite build succeeds.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/web
git commit -m "feat(web): scaffold chat layout"
```

## Task 13: Integrate Real Za-go Behind Connector Interface

**Files:**

- Modify: `apps/zalo-connector/go.mod`
- Create: `apps/zalo-connector/internal/zalo/zago_client.go`
- Test: `apps/zalo-connector/internal/zalo/zago_client_test.go`

- [ ] **Step 1: Add Za-go dependency**

Run in `apps/zalo-connector`:

```bash
go get github.com/tranhaonguyendev/za-go@main
```

Expected: `go.mod` and `go.sum` update.

- [ ] **Step 2: Write constructor test**

Create `apps/zalo-connector/internal/zalo/zago_client_test.go`:

```go
package zalo

import "testing"

func TestNewZagoClientRequiresIMEI(t *testing.T) {
 _, err := NewZagoClient(Config{IMEI: ""})
 if err == nil {
  t.Fatal("expected missing IMEI error")
 }
}
```

- [ ] **Step 3: Run test and verify it fails**

Run: `go test ./...` in `apps/zalo-connector`.

Expected: FAIL because `NewZagoClient` does not exist.

- [ ] **Step 4: Implement Za-go wrapper constructor**

Create `apps/zalo-connector/internal/zalo/zago_client.go`:

```go
package zalo

import (
 "context"
 "fmt"
 "strings"

 zago "github.com/tranhaonguyendev/za-go"
)

type Config struct {
 Phone string
 Password string
 IMEI string
 UserAgent string
 Session any
}

type ZagoClient struct { api *zago.ZaloAPI }

func NewZagoClient(config Config) (*ZagoClient, error) {
 if strings.TrimSpace(config.IMEI) == "" {
  return nil, fmt.Errorf("imei is required")
 }
 api, err := zago.Zalo(config.Phone, config.Password, config.IMEI, config.Session, config.UserAgent, false, zago.LoginAPI)
 if err != nil {
  return nil, err
 }
 return &ZagoClient{api: api}, nil
}

func (c *ZagoClient) SendText(ctx context.Context, threadID string, threadType string, text string) (string, error) {
 msg := zago.Message{Msg: text}
 tt := zago.ThreadTypeUSER
 if threadType == "GROUP" { tt = zago.ThreadTypeGROUP }
 result, err := c.api.SendMessage(msg, threadID, tt)
 if err != nil { return "", err }
 return fmt.Sprintf("%v", result), nil
}
```

- [ ] **Step 5: Run tests**

Run: `go test ./...` in `apps/zalo-connector`.

Expected: PASS or compile failure if Za-go `Message` fields differ. If fields differ, inspect Za-go `worker.Message` and update only the wrapper to match the actual public type.

- [ ] **Step 6: Verify session export risk**

Inspect Za-go public API for an export-session method. If none exists, create an issue in this repo by documenting the risk in `docs/zago-session-export.md` with this content:

```markdown
# Za-go Session Export Risk

Za-go exposes `SetSession(sessionCookies)` but the current public API must be verified for a matching session export method after QR login.

Required outcome before production MVP:

- Confirm `WaitQRCodeConfirm` returns enough data to persist and restore a session, or
- Patch/fork Za-go with a minimal `ExportSession()` method that returns serializable session material without logging secrets.
```

- [ ] **Step 7: Commit**

Run:

```bash
git add apps/zalo-connector docs/zago-session-export.md
git commit -m "feat(connector): wrap Za-go client"
```

## Task 14: Add End-To-End Smoke Script

**Files:**

- Create: `scripts/smoke.ps1`

- [ ] **Step 1: Create smoke script**

Create `scripts/smoke.ps1`:

```powershell
$ErrorActionPreference = "Stop"

docker compose config | Out-Null

Push-Location apps/api
npm test
npm run build
Pop-Location

Push-Location apps/web
npm test
npm run build
Pop-Location

Push-Location apps/zalo-connector
go build ./cmd/connector
Pop-Location

"Smoke checks passed"
```

- [ ] **Step 2: Run smoke script**

Run: `powershell -ExecutionPolicy Bypass -File scripts/smoke.ps1`

Expected: all tests and builds pass, final output includes `Smoke checks passed`.

- [ ] **Step 3: Commit**

Run:

```bash
git add scripts/smoke.ps1
git commit -m "chore: add smoke verification script"
```

## Task 15: Final MVP Verification Checklist

**Files:**

- Create: `docs/verification/mvp-checklist.md`

- [ ] **Step 1: Add manual verification checklist**

Create `docs/verification/mvp-checklist.md`:

```markdown
# MVP Verification Checklist

- [ ] Owner can login to the system.
- [ ] Owner can connect Zalo via QR.
- [ ] Connector reaches `listening` state.
- [ ] USER messages arrive realtime in UI.
- [ ] GROUP messages arrive realtime in UI.
- [ ] Agent can claim a conversation.
- [ ] Agent can send text.
- [ ] Agent can send image/file.
- [ ] Outbound messages transition through queued/sending/sent or failed.
- [ ] Delivered/seen updates appear if Za-go emits them.
- [ ] Typing appears realtime when supported.
- [ ] Media is archived into MinIO.
- [ ] Restarting `api` does not lose unprocessed Redis events.
- [ ] Restarting `zalo-connector` restores session and reconnects when the session is still valid.
- [ ] Session expiry shows a clear QR-required state.
- [ ] Agent cannot send in a thread assigned to another agent.
- [ ] Owner and Manager can view all threads.
```

- [ ] **Step 2: Run full smoke**

Run: `powershell -ExecutionPolicy Bypass -File scripts/smoke.ps1`

Expected: `Smoke checks passed`.

- [ ] **Step 3: Commit**

Run:

```bash
git add docs/verification/mvp-checklist.md
git commit -m "docs: add MVP verification checklist"
```

## Self-Review Notes

- Spec coverage: architecture, Redis Streams, PostgreSQL model, API modules, assignment policy, connector contract, Za-go wrapper, media worker skeleton, React UI, Docker Compose, and verification are covered.
- Intentional deferrals: full auth, complete REST controllers, complete inbound message normalization, MinIO byte upload implementation, and real QR login UI should be implemented as follow-up tasks after this foundation is green. They depend on scaffolded modules and contracts created here.
- Critical implementation risk: Za-go session export must be verified before production deployment. The plan includes a dedicated verification/documentation step.
