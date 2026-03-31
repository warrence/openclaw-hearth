# Hearth First-Class Channel Implementation Brief

## Why this brief exists
Dad asked for a concrete plan to move Hearth from a Laravel-to-OpenClaw bridge into a **first-class OpenClaw app channel**, so Hearth can eventually act like a real messaging surface similar to Telegram/Discord instead of only a custom frontend calling `openclaw gateway call ...`.

This brief is intentionally practical: it should help Hearth continue the build from the current working prototype without losing momentum.

---

## Goal
Make Hearth a **first-class OpenClaw channel** while keeping:
- the custom Hearth UI
- the app-owned conversation/sidebar/dashboard UX
- Laravel/Nest as the app backend boundary

What changes is the transport/runtime layer.

Instead of:

```text
Hearth UI -> Laravel bridge -> openclaw gateway call agent -> OpenClaw
```

we want:

```text
Hearth UI -> Hearth backend channel service -> OpenClaw app channel -> OpenClaw runtime
```

---

## What “first-class channel” means in practice
A first-class Hearth channel should let OpenClaw treat Hearth messages like real channel events.

That means OpenClaw should natively understand:
- channel = `hearth`
- account / installation / household scope
- app user / profile id
- resolved person identity
- conversation id
- channel message id
- reply-to linkage
- attachments
- status/progress/outbound events

And importantly, it should allow **proactive outbound messages** back into Hearth, not only replies to an inbound request.

---

## Current constraints we should preserve
Do **not** break these current strengths:
- Laravel DB remains the source of truth for app-visible conversation/message UI state
- one Hearth conversation = one OpenClaw session
- profile/person identity remains explicit and inspectable
- app UX metadata stays app-owned (titles, archive state, list ordering, dashboard summaries)
- the current bridge remains usable while native channel support is being built

---

## Recommended architecture split

### Hearth app/backend owns
- authenticated app users/profiles
- conversations list
- app-visible messages table
- archive/title/search metadata
- attachments persistence
- notification preferences
- app dashboard state

### OpenClaw channel/runtime owns
- inbound message routing
- outbound agent replies/events
- session semantics
- runtime identity context
- native memory/plugin identity flow
- proactive outbound sends into Hearth

---

## The minimum native message contract
This is the next real design anchor.

### Inbound event: app -> OpenClaw
```json
{
  "channel": "hearth",
  "accountId": "default",
  "conversationId": "conv_123",
  "channelMessageId": "msg_456",
  "profileId": "profile_alex",
  "profileSlug": "alex",
  "userId": "user_1",
  "personIdentity": "person:alex",
  "agentId": "daughter-aeris",
  "text": "Hello",
  "attachments": [],
  "replyToChannelMessageId": null,
  "sentAt": "2026-03-27T15:00:00Z",
  "metadata": {
    "source": "hearth-app",
    "conversationVisibility": "private"
  }
}
```

### Outbound event: OpenClaw -> app
```json
{
  "channel": "hearth",
  "accountId": "default",
  "conversationId": "conv_123",
  "channelMessageId": "out_789",
  "role": "assistant",
  "agentId": "daughter-aeris",
  "personIdentity": "person:alex",
  "text": "Hey Dad",
  "attachments": [],
  "replyToChannelMessageId": "msg_456",
  "event": "assistant.message",
  "sentAt": "2026-03-27T15:00:02Z",
  "metadata": {
    "sessionKey": "agent:daughter-aeris:person:alex:app:alex:conv:123"
  }
}
```

### Progress/status events: OpenClaw -> app
```json
{
  "channel": "hearth",
  "conversationId": "conv_123",
  "event": "status",
  "status": "running",
  "progress": {
    "phase": "thinking",
    "elapsedMs": 4300
  },
  "metadata": {
    "sessionKey": "agent:daughter-aeris:person:alex:app:alex:conv:123"
  }
}
```

---

## Identity rules
These should become explicit channel/runtime fields, not hidden prompt hacks.

### Required identity fields
- `profileId`
- `profileSlug`
- `userId`
- `personIdentity`
- `conversationId`
- `channelMessageId`
- `agentId`

### Rule
`personIdentity` must be first-class in the runtime event, not inferred only from `sessionKey` parsing.

The current session-key convention can remain temporarily as a compatibility fallback, but it should stop being the primary truth source.

---

## Session model
Keep the current product rule:

## One Hearth conversation = one OpenClaw session

But formalize it under the channel contract:
- app conversation creates/owns a durable OpenClaw session key
- subsequent messages for that conversation always reuse it
- archived conversation does not destroy the OpenClaw session by default
- new chat creates a fresh OpenClaw session

---

## Proactive messaging requirement
This is one of the biggest reasons to go first-class.

OpenClaw should be able to send into Hearth even when there is no immediate inbound message, for example:
- reminders
- task alerts
- family coordination notifications
- system notices
- follow-up prompts

That requires an outbound delivery path such as:

```text
OpenClaw message tool / runtime event
-> Hearth channel outbound adapter
-> Laravel/Nest app API
-> persist message
-> push/SSE/UI update
```

Without this, Hearth remains “reply-only” and not a full messaging surface.

---

## Recommended implementation phases

## Phase 0 — preserve working prototype
Do not break the current bridge.
Keep current chat send/receive working while the new path is introduced behind a feature flag.

## Phase 1 — formalize the app channel contract
Deliverables:
- inbound event schema
- outbound event schema
- progress/status event schema
- attachment envelope shape
- identity/session field definitions

## Phase 2 — backend channel adapter
Build a Hearth backend channel service that can:
- accept app-originated message events
- normalize them into the channel contract
- forward them to OpenClaw as channel events
- receive outbound channel events/replies/status
- persist them back into app tables

## Phase 3 — OpenClaw native channel integration
Introduce a real Hearth channel/provider path in OpenClaw so the runtime sees Hearth as a first-class channel source.

Minimum support:
- inbound message handling
- outbound assistant messages
- status/progress events
- session mapping
- identity context

## Phase 4 — proactive outbound send
Enable OpenClaw-originated message delivery into Hearth without requiring a preceding inbound app message.

## Phase 5 — retire bridge hacks gradually
Reduce or remove:
- hidden runtime-context prompt injection as the main identity fix
- session-key parsing as the primary person identity mechanism
- CLI-shell bridge as the main transport for chat runs

---

## Suggested transport shape
Short term, the backend can still remain the ingress point, but it should stop shelling out to CLI as the final architecture.

### Preferred long-term shape
```text
Hearth frontend
-> Hearth API/backend
-> native Hearth channel adapter
-> OpenClaw runtime
-> native Hearth outbound events
-> Hearth API persists + pushes to UI
```

This keeps trust boundaries sane while making the runtime integration clean.

---

## Acceptance criteria for “first-class enough”
Hearth should count as first-class when all of these are true:
- app messages enter OpenClaw through a real Hearth channel contract
- OpenClaw receives explicit `personIdentity` and `conversationId`
- OpenClaw can proactively send outbound messages into Hearth
- progress/status events flow back without CLI lifecycle hacks being the core mechanism
- one conversation = one session still holds naturally
- app DB stays the source of truth for app-visible message history

---

## Immediate next tasks for Hearth
1. Review `native-channel-architecture.md` and this brief together.
2. Create a concrete **app channel contract spec** file under `docs/`.
3. Decide the exact backend boundary:
   - Laravel-only,
   - Nest-owned transport,
   - or hybrid during migration.
4. Design the outbound delivery path for proactive Hearth messages.
5. Propose a feature-flagged implementation sequence that keeps the current bridge working until native channel parity exists.

---

## Strong recommendation
Do **not** treat the current Laravel bridge as the final transport architecture.
It was the right MVP move, but Hearth’s long-term value is much higher if it becomes a real OpenClaw-native app channel.
