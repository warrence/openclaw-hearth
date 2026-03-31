# OpenClaw Family App — Architecture Draft

## 1. Purpose
This document defines the initial architecture for the OpenClaw Family App MVP.

The goal is to support:
- multiple users/profiles
- multiple chat sessions per user
- OpenClaw-backed conversations
- a lightweight gateway dashboard
- safe handling of the gateway token through a backend-owned trust boundary

This architecture is optimized for:
- fast MVP delivery
- family use first
- self-hosted-first privacy posture
- future evolution into a broader family/team AI workspace

---

## 2. Architecture Summary

## Core stack
- **Frontend:** Vue 3 + Quasar PWA
- **Backend:** Laravel
- **AI runtime:** OpenClaw Gateway
- **Persistence:** Laravel app database
- **Realtime:** SSE first, WebSockets later if needed

## Core principle
**One app conversation maps to one isolated OpenClaw session.**

This is the rule that gives the app a ChatGPT-like multi-session feel while still using OpenClaw underneath.

---

## 3. High-Level System Design

```text
[User / Family Member]
        |
        v
[Quasar PWA Frontend]
        |
        v
[Laravel Backend]
   - auth/profile context
   - conversation metadata
   - session mapping
   - gateway connection handling
        |
        v
[OpenClaw Gateway]
   - agent runtime
   - tools
   - models
   - memory
   - sessions
```

### Responsibilities by layer

## Frontend
Responsible for:
- profile selection / login
- chat list UI
- conversation UI
- dashboard UI
- settings UI
- streaming reply rendering

The frontend should **not** hold the OpenClaw gateway token directly.

## Laravel Backend
Responsible for:
- user/profile management
- conversation records
- app message records
- app conversation → OpenClaw session mapping
- secure gateway token storage
- forwarding chat requests to OpenClaw
- relaying streaming responses back to frontend
- status/dashboard data aggregation

## OpenClaw Gateway
Responsible for:
- actual agent execution
- tool calling
- session behavior
- model routing
- agent orchestration
- memory integration

---

## 4. Trust Boundary and Privacy Model

## Self-hosted-first principle
The recommended trust model for MVP is:
- user/family hosts the app backend
- user/family hosts the OpenClaw gateway
- gateway token stays server-side
- messages do not need to pass through third-party infrastructure

## Pairing direction
For MVP, gateway connectivity can start with backend-owned token configuration.
Longer term, product UX should evolve toward a pairing-style onboarding flow (closer to Telegram/WhatsApp-style trust setup) so normal users do not have to think about raw gateway tokens.

## Privacy rule
The backend is still inside the trust path, so it must:
- minimize logging of raw message content
- encrypt stored gateway secrets
- separate metadata from sensitive content where practical
- avoid unnecessary persistence of full raw content beyond product needs

## Gateway token rule
- token stored only in Laravel backend
- never exposed to frontend JS if avoidable
- frontend authenticates to Laravel, not directly to OpenClaw

---

## 5. Identity Model

## Core rule
**Person identity and long-term memory belong in the OpenClaw layer.**

The app is a replaceable client/interface layer. It should not become the source of truth for who a person is or what long-term memory belongs to them.

## People
The app is person-based, not channel-based.

Initial identities:
- `person:alex`
- `person:sam`
- `person:kid`

## Why
This avoids coupling product identity to Telegram or any one transport channel.
It also keeps the app replaceable in the future: if a new UI/client is built later, it should still be able to use the same OpenClaw-side person identity and memory.

## Implication
- long-term memory should map to OpenClaw person identities
- the app should treat profile selection as a UI/client concern mapped onto OpenClaw identity
- conversation titles, archived state, and other chat UX metadata may live in the app layer
- long-term memory ownership should not depend on the app database alone

---

## 6. Session Model

## Core rule
**One app chat = one OpenClaw session**

Example:
- Alex has chats:
  - Product Ideas
  - Family Planning
  - Random Questions
- Each of those should map to a distinct OpenClaw session key

## Desired effect
This gives:
- separate context windows
- separate short-term memory per conversation
- resumable chats
- familiar ChatGPT-style UX

## Session mapping strategy (MVP)
Laravel stores a mapping like:
- `conversation.id` → `openclaw_session_key`

When the user opens a chat, the app loads:
- app metadata from Laravel
- messages from Laravel and/or OpenClaw transcript sync strategy

When the user sends a new message:
- Laravel looks up the mapped OpenClaw session
- sends the message to that session target
- streams the reply back

## Open question
Need to determine the cleanest technical mechanism to create and preserve OpenClaw session keys from the app side.

Possible strategies:
1. app-generated session key conventions
2. use OpenClaw new/reset/session semantics and store resulting mapping
3. use dedicated per-conversation routing/session abstraction through backend

This needs validation during implementation.

---

## 7. Conversation Lifecycle

## Create new chat
1. user selects profile
2. user taps “new chat”
3. Laravel creates a `conversations` row
4. Laravel creates or assigns an OpenClaw session key
5. optional starter title is generated later

## Send message
1. frontend sends message to Laravel
2. Laravel validates user + conversation ownership
3. Laravel resolves the OpenClaw session key
4. Laravel forwards message to OpenClaw
5. OpenClaw runs agent/session normally
6. response streams back through Laravel to frontend
7. Laravel records message metadata

## Resume old chat
1. frontend opens conversation
2. Laravel returns stored metadata/messages
3. new user messages continue against same mapped OpenClaw session

## Archive chat
1. conversation marked archived in app DB
2. no OpenClaw deletion required initially
3. archived chats can be reopened later

---

## 8. Data Model (MVP)

## users
Purpose: app-level people/profiles

Fields:
- id
- name
- slug
- avatar
- memory_namespace
- default_agent_id
- created_at
- updated_at

## conversations
Purpose: app-visible chat sessions

Fields:
- id
- user_id
- title
- agent_id
- openclaw_session_key
- status
- archived_at
- created_at
- updated_at

## messages
Purpose: app conversation history

Fields:
- id
- conversation_id
- role
- content
- model
- metadata_json
- created_at

## gateway_connections
Purpose: backend-owned OpenClaw gateway settings

Fields:
- id
- name
- base_url
- auth_token_encrypted
- status
- last_checked_at
- created_at
- updated_at

---

## 9. Agent Model

## MVP agent support
MVP should support selecting the agent per conversation.

Initial supported agents:
- Aeris
- possibly Forge/Sarai later if product direction needs it

## Recommendation
For MVP, keep it simple:
- default to Aeris first
- support agent selection in data model
- expose UI for switching only if it doesn’t complicate v1 too much

---

## 10. Dashboard Model

## MVP dashboard scope
The dashboard should be lightweight.

Initial cards/sections:
- gateway online/offline
- gateway URL / connected status
- default model
- active agents
- last known error / warning

## Data flow
Laravel can either:
- call OpenClaw status endpoints on demand
- or cache status snapshots briefly for faster UI response

Recommendation:
- on-demand first
- short caching later if needed

---

## 11. Realtime / Streaming

## Recommendation
Start with **SSE** for streaming assistant responses and lightweight live status updates.

## Why SSE first
- simpler than full WebSockets
- enough for streaming assistant text
- enough for basic in-chat status events
- easier MVP implementation

## Later upgrade path
Use WebSockets when needed for:
- richer real-time updates
- multi-agent live status
- dashboard push events
- approvals or live tool state
- more advanced progress/task telemetry across chats and dashboard

---

## 12. Security Considerations

## Required for MVP
- encrypt gateway token at rest
- authenticate app users/profiles properly
- validate conversation ownership on every request
- limit backend logs containing chat content
- avoid exposing OpenClaw auth token to browser

## Later considerations
- audit log
- role-based permissions
- multi-family / team tenancy
- secure remote relay model

---

## 13. Future Architecture Hooks

This MVP should leave room for:
- family shared reminders/tasks
- cross-user actions (e.g. remind Sam from Alex session)
- shared spaces/boards
- memory browser
- approvals UI
- multiple gateways
- hosted relay / subscription product

These features should not be fully built now, but the architecture should avoid blocking them.

---

## 14. Recommended Build Order

### Stage 1 — Skeleton
- Laravel app shell
- Quasar PWA shell
- profile model
- conversation model
- gateway connection model

### Stage 2 — Core chat
- create new chat
- list chats
- open chat
- send message
- stream reply
- store mapped session key

### Stage 3 — Dashboard
- gateway status page
- agent list/basic health

### Stage 4 — Internal validation
- Alex workflow
- Sam workflow
- Kid workflow
- fix UX friction

---

## 15. Open Questions

1. What is the best technical mechanism to create durable OpenClaw session keys from the app layer?
2. Should app messages be fully mirrored in Laravel DB, or partially synced from OpenClaw transcripts?
3. Should MVP start with profile picker only instead of full auth?
4. Should agent selection be visible in MVP UI or deferred?
5. Are cross-user reminders MVP or Phase 2?

---

## 16. Current Recommendation

Build self-hosted-first.

Use Laravel as the secure broker between PWA and OpenClaw.
Use one conversation = one OpenClaw session.
Start with personal multi-chat experience first, then expand toward family coordination features.
