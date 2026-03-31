# Hearth Nest Backend

This directory contains the new NestJS backend foundation for Hearth.

## Important separation

- `../api` remains the live Laravel backend and is intentionally untouched for rollback safety.
- `./api-nest` is the separate long-term replacement track.

## What is included

- NestJS TypeScript app scaffold
- global environment configuration with validation
- `/` and `/api/info` info routes
- `/health` and `/api/health` routes
- read-side conversation endpoints for list/detail/message history
- PostgreSQL-ready database service driven by environment variables
- Docker basics for local PostgreSQL-backed development
- Jest and ESLint setup

## Quick start

```bash
cd api-nest
npm install
cp .env.example .env
npm run start:dev
```

The server listens on `http://127.0.0.1:3001` by default.

## Implemented migration routes

These routes are currently implemented in NestJS:

- `GET /`
- `GET /api/info`
- `GET /health`
- `GET /api/health`
- `GET /api/users/:userId/conversations`
- `GET /api/conversations/:conversationId`
- `POST /api/users/:userId/conversations`
- `GET /api/conversations/:conversationId/messages`
- `PATCH /api/conversations/:conversationId`
- `POST /api/conversations/:conversationId/archive`
- `POST /api/conversations/:conversationId/restore`

Conversation list behavior follows the Laravel source for the current read slice:

- `scope=active|archived`
- `search=...` across conversation title and message content
- `limit=1..50` applied only when `search` is present, matching current Laravel behavior
- `messages_count` included on list rows
- `search_match` included only for search results

## Temporary auth gap

Laravel protects the conversation routes with session auth plus ownership checks. That auth stack is not wired in `api-nest` yet, so this slice uses a temporary explicit header:

- `x-actor-user-id: <user id>`

Protected conversation routes return:

- `401` when the header is missing or invalid
- `403` when the actor does not own the requested user or conversation

This is intentionally a migration stopgap to avoid exposing cross-user reads before real auth/session support lands.

## Response-shape notes

- JSON keys remain snake_case to stay close to Laravel responses.
- `GET /api/conversations/:conversationId` includes the nested `user` object and omits hidden user secrets such as `pin_hash`.
- `POST /api/users/:userId/conversations`, `PATCH /api/conversations/:conversationId`, `POST /api/conversations/:conversationId/archive`, and `POST /api/conversations/:conversationId/restore` return Laravel-like conversation records for the guarded web migration path.
- `GET /api/conversations/:conversationId/messages` returns messages ordered by ascending `id`.
- SQL uses Postgres-safe patterns (`ILIKE`, `LATERAL`, parameterized queries, `NULLS LAST`) and does not assume SQLite behavior.

## Environment

Copy `.env.example` to `.env` and adjust as needed.

Database configuration supports either:

- `DATABASE_URL=postgres://...`
- individual `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD`

`DATABASE_SYNCHRONIZE` defaults to `false` and should stay false outside disposable local development.

## Local Postgres via Docker

Start only PostgreSQL:

```bash
cd api-nest
docker compose -f compose.dev.yml up -d
```

Then run the app locally with `npm run start:dev`.

## Validation commands

```bash
cd api-nest
npm run build
npm test
npm run lint
```

## Next backend work

Suggested next steps once feature work begins:

- replace temporary `x-actor-user-id` handling with real auth/session integration
- add migrations and a standardized data-access layer for Nest-owned schema changes
- add structured logging and request correlation
- wire API versioning and shared DTO conventions
