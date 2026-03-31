# OpenClaw Family App — Schema and API Draft

## 1. Purpose
This document defines the initial database schema and backend API for the OpenClaw Family App MVP.

It is designed to support:
- multiple user profiles
- multiple chat conversations per profile
- conversation-to-OpenClaw session mapping
- gateway connection storage
- streaming chat responses
- basic gateway dashboard state

This draft is optimized for MVP speed and clarity, not full enterprise complexity.

---

## 2. Database Schema

## 2.1 users
Represents a person/profile in the app.

Important architectural note:
- this table is for app/client-side profile and UX management
- it should map to OpenClaw-side person identity, not replace it as the canonical long-term memory source

### Fields
- `id` — bigint / uuid
- `name` — string
- `slug` — string, unique
- `avatar` — nullable string
- `memory_namespace` — string
- `default_agent_id` — nullable string
- `is_active` — boolean default true
- `created_at`
- `updated_at`

### Notes
Examples:
- `Alex`, slug `alex`, memory namespace `person:alex`
- `Sam`, slug `sam`, memory namespace `person:sam`
- `Kid`, slug `kid`, memory namespace `person:kid`

---

## 2.2 conversations
Represents one app-visible chat session.

### Fields
- `id`
- `user_id` — FK to users
- `title` — string
- `agent_id` — string
- `openclaw_session_key` — string, unique
- `status` — enum/string (`active`, `archived`)
- `archived_at` — nullable datetime
- `last_message_at` — nullable datetime
- `created_at`
- `updated_at`

### Notes
This is the core mapping table for:
- one app conversation
- one OpenClaw session

---

## 2.3 messages
Represents messages shown in the app chat UI.

### Fields
- `id`
- `conversation_id` — FK to conversations
- `role` — enum/string (`user`, `assistant`, `system`)
- `content` — long text
- `model` — nullable string
- `metadata_json` — nullable JSON
- `source` — nullable string (`app`, `openclaw`, `sync`)
- `created_at`
- `updated_at`

### Notes
MVP can store a normalized app-visible message history here.
This avoids depending entirely on raw OpenClaw transcript files for UI rendering.

---

## 2.4 gateway_connections
Stores OpenClaw gateway settings.

### Fields
- `id`
- `name` — string
- `base_url` — string
- `auth_token_encrypted` — text
- `status` — nullable string (`online`, `offline`, `unknown`)
- `last_checked_at` — nullable datetime
- `last_error` — nullable text
- `is_default` — boolean default true
- `created_at`
- `updated_at`

### Notes
MVP assumes one gateway, but schema should allow more later.

---

## 2.5 optional future tables (not MVP required)
### reminders
For cross-user reminders/tasks

### shared_tasks
For family/team task delegation

### memberships / households / teams
For multi-tenant/shared spaces later

---

## 3. Recommended Laravel Relationships

## User
- hasMany conversations

## Conversation
- belongsTo user
- hasMany messages

## Message
- belongsTo conversation

## GatewayConnection
- standalone in MVP

---

## 4. API Design Principles

1. Frontend talks only to Laravel backend
2. Laravel owns OpenClaw gateway communication
3. OpenClaw token is never exposed to frontend
4. One API call should map cleanly to one user action
5. Streaming should be supported for chat replies

---

## 5. MVP API Endpoints

## 5.1 Profiles / Users
### `GET /api/users`
Return available user profiles.

#### Response example
```json
[
  {
    "id": 1,
    "name": "Alex",
    "slug": "alex",
    "avatar": null,
    "memory_namespace": "person:alex",
    "default_agent_id": "aeris"
  }
]
```

### `GET /api/users/{id}`
Return one user profile.

---

## 5.2 Conversations
### `GET /api/users/{user}/conversations`
List conversations for a user.

### `POST /api/users/{user}/conversations`
Create a new conversation.

#### Request example
```json
{
  "title": "New Chat",
  "agent_id": "aeris"
}
```

#### Response example
```json
{
  "id": 15,
  "user_id": 1,
  "title": "New Chat",
  "agent_id": "aeris",
  "openclaw_session_key": "app:alex:conv:15",
  "status": "active"
}
```

### `GET /api/conversations/{conversation}`
Get one conversation.

### `PATCH /api/conversations/{conversation}`
Rename or update conversation metadata.

#### Request example
```json
{
  "title": "Product Ideas"
}
```

### `POST /api/conversations/{conversation}/archive`
Archive a conversation.

---

## 5.3 Messages
### `GET /api/conversations/{conversation}/messages`
Fetch message history for a conversation.

### `POST /api/conversations/{conversation}/messages`
Send a user message and begin streaming assistant response.

#### Request example
```json
{
  "content": "Help me plan the MVP for this app"
}
```

#### Backend behavior
1. validate ownership/access
2. save user message
3. resolve `openclaw_session_key`
4. send message to OpenClaw
5. stream assistant response back to frontend
6. save assistant output

### Streaming recommendation
Use SSE endpoint, for example:
- `POST /api/conversations/{conversation}/messages`
- or split into:
  - `POST /api/conversations/{conversation}/messages`
  - `GET /api/conversations/{conversation}/stream/{messageRunId}`

Implementation can choose whichever is simpler.

---

## 5.4 Gateway
### `GET /api/gateway/status`
Return gateway health summary.

#### Response example
```json
{
  "status": "online",
  "base_url": "http://127.0.0.1:18789",
  "last_checked_at": "2026-03-11T14:00:00Z",
  "agents": [
    { "id": "aeris", "status": "online" },
    { "id": "forge", "status": "planned" }
  ],
  "default_model": "openai-codex/gpt-5.4"
}
```

### `POST /api/gateway/test-connection`
Test whether the configured OpenClaw gateway is reachable.

#### Request example
```json
{
  "base_url": "http://127.0.0.1:18789",
  "token": "..."
}
```

### `PUT /api/gateway/config`
Save gateway configuration.

---

## 6. OpenClaw Integration Contract

## 6.1 Core need
Laravel must reliably map one app conversation to one OpenClaw session.

## 6.2 Proposed first convention
Use an app-controlled session key pattern such as:

```text
app:<user_slug>:conv:<conversation_id>
```

Example:
- `app:alex:conv:15`
- `app:sam:conv:8`
- `app:kid:conv:24`

## 6.3 Why
This gives:
- predictable mapping
- easy debugging
- stable session identity per app conversation

## 6.4 Open question
Need to confirm the best technical way for Laravel to create/use this mapped session key through the OpenClaw gateway/runtime APIs.

This is a validation task for implementation.

---

## 7. Suggested Validation Rules

## conversations
- `title` required, max length reasonable
- `agent_id` must be from allowed agent list
- `user_id` must exist

## messages
- `content` required
- trim empty input
- limit max length for MVP if needed

## gateway
- `base_url` must be valid URL
- token must be stored encrypted

---

## 8. Suggested UI-to-API Flows

## Flow: App start
1. frontend loads users
2. user selects profile
3. frontend loads conversations for that user

## Flow: New chat
1. user taps new chat
2. frontend POSTs to create conversation
3. backend creates row and mapped session key
4. frontend opens empty conversation screen

## Flow: Send message
1. user sends prompt
2. frontend POSTs message
3. backend stores message
4. backend forwards to OpenClaw session
5. frontend receives streaming output
6. backend stores assistant reply

## Flow: Rename chat
1. frontend PATCHes conversation title
2. backend updates row

## Flow: Dashboard
1. frontend requests gateway status
2. backend returns current health snapshot

---

## 9. Recommended Implementation Order

### Backend first
1. migrations
2. Eloquent models
3. conversation/message API
4. gateway config API
5. OpenClaw client service
6. streaming endpoint

### Frontend after base backend exists
1. profile picker
2. conversation list
3. chat screen
4. dashboard screen

---

## 10. Open Questions

1. Should `users` be full auth users or simple family profiles in MVP?
2. Should conversation titles be auto-generated after first exchange?
3. Should messages be fully persisted in app DB, or only partially mirrored from OpenClaw?
4. What is the cleanest OpenClaw session binding approach from Laravel?
5. How much OpenClaw transcript syncing is necessary for MVP?

---

## 11. Recommendation

Use this schema/API as the first build target.

It is small enough to ship quickly, but structured enough to support:
- family profiles
- multi-chat sessions
- gateway dashboard
- later cross-user reminders and shared spaces
