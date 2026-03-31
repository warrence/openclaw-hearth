# OpenClaw Family App — Native Channel Architecture

## Goal
Transition the chat app from a custom Laravel-to-OpenClaw bridge toward a first-class OpenClaw-native app channel.

This should make the app behave more like Telegram/Discord integrations at the runtime layer, while keeping our custom UI and dashboard.

## Why
Current custom bridge works, but has weaknesses:
- profile/person identity needs custom injection
- memory behavior is less naturally aligned with OpenClaw
- session/addressing consistency requires workaround logic
- long-term architecture is more fragile

A native channel path should improve:
- routing consistency
- session identity consistency
- memory behavior consistency
- easier future support for progress/events/attachments

## Principle
The app should remain a custom UI/client, but the message transport should become a real OpenClaw channel/integration rather than a custom bridge being the final architecture.

---

## Target Model

```text
[Family App UI]
     |
     v
[App Backend / Session Service]
     |
     v
[OpenClaw Native App Channel]
     |
     v
[OpenClaw Agent Runtime + Memory]
```

The UI can stay custom.
The transport/routing layer should become native to OpenClaw.

---

## Desired Properties

### 1. First-class channel semantics
App messages should enter OpenClaw like a real channel event, not an improvised bridge payload.

### 2. Stable person identity
The transport should carry:
- profile identity
- channel/user identity
- person identity mapping
without relying on hidden prompt text as the main fix.

### 3. Native session behavior
Each app conversation should map naturally into OpenClaw session handling.

### 4. Native memory behavior
OpenClaw memory plugins should receive the correct person/session identity through runtime context directly.

### 5. Better event model
The channel should support:
- inbound messages
- outbound replies
- status/progress events
- future typing/progress/attachments

---

## What stays from current app work
We should keep:
- Quasar PWA frontend
- Laravel app/database for UI metadata
- conversation list/sidebar
- dashboard
- chat UX

What changes is the deeper transport/routing path.

### App layer should still own
- chat titles
- archived state
- UI metadata
- frontend state
- dashboard presentation

### OpenClaw channel/runtime should own
- inbound message routing
- session semantics
- identity context at runtime
- memory integration behavior

---

## Proposed Direction

## Phase A — keep prototype working
Maintain current app as functional prototype while planning the native channel.

## Phase B — define app channel contract
Design what the native app channel needs to carry for each message:
- app user/profile id
- person identity
- conversation id
- channel message id
- timestamps
- reply/event stream hooks

## Phase C — implement OpenClaw-native app channel
Create a new OpenClaw channel/integration for the app.

Possible shape:
- app backend sends normalized channel events into OpenClaw
- OpenClaw treats them like a first-class channel source
- replies/events come back through the same channel contract

## Phase D — reduce bridge hacks
Remove or minimize:
- hidden runtime persona prompt injection
- session-key identity parsing as primary mechanism
- custom workaround logic where native channel fields should exist

---

## Key Open Questions

1. Should the app backend remain the ingress point, or should the frontend talk to a channel-specific backend endpoint directly?
2. What exact OpenClaw channel interface should the app channel implement?
3. How should progress/status events flow back to the UI?
4. Should the app channel support full duplex event streams from the start?
5. How should person identity be represented natively in channel/runtime payloads?

---

## Immediate Next Design Task
Define the **app channel message contract**:
- inbound event structure
- outbound reply/event structure
- identity/session fields
- progress/status event fields

That contract is the next real design step before implementation.

---

## Recommendation
Continue using the current bridge as the working prototype, but stop treating it as the final architecture.

The final architecture should be:
- custom app UI
- OpenClaw-native app channel
- OpenClaw-owned memory/session identity core
