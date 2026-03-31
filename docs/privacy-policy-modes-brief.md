# Hearth Privacy / Policy Modes Brief

## Why this exists
Hearth is likely to be open-sourced later, so privacy behavior should not be hardcoded around one family’s assumptions.

The current conclusion: Hearth should support configurable privacy/isolation modes, with a safe default for broader public use.

## Core recommendation
Add a user-visible privacy policy system with at least three modes:

1. **Strict isolation**
2. **Balanced isolation**
3. **Trusted household / family mode**

For open-source/public release, the recommended default is:

- **Default: Strict isolation**

## Recommended model split
Do not treat all privacy concerns as one toggle.

Instead, split them into at least two policy layers:

### 1) Identity isolation policy
Controls whether the assistant can:
- acknowledge other users exist
- reveal cross-user relationship facts
- respond to “who is X?” questions
- trust claims like “I’m actually Alex” inside another chat
- relay messages between users/chats

### 2) Memory sharing policy
Controls whether the assistant can:
- use globally shared family/household context
- reuse facts learned in one person’s chat inside another person’s chat
- surface shared reminders or household facts
- access/project long-term memory across profiles

These two layers should be configurable separately if practical.

## Suggested policy behavior

### Strict isolation
Best for open-source default and privacy-sensitive users.

Behavior:
- no cross-chat identity facts
- no relationship disclosures about other people
- no “who is Alex / Sam / Kid?” answers beyond generic refusal
- no message relays without explicit verified routing
- no trusting identity claims made inside a different chat
- no shared long-term memory across profiles by default
- secrets, credentials, PINs, private logs always blocked

### Balanced isolation
Best for most normal household use.

Behavior:
- allow minimal harmless context if already intentionally shared in system design
- still block private conversation history, credentials, PINs, auth secrets
- still block impersonation-based requests
- still require explicit permission for cross-user actions
- allow carefully scoped shared household context only if marked shareable

### Trusted household / family mode
Best for a deliberately opt-in family setup.

Behavior:
- can acknowledge limited family relationship context
- can use selected shared household memory
- may support family-friendly conveniences like shared reminders later
- still never reveal secrets, PINs, auth tokens, private logs, or hidden message history
- still should not accept “I am X” as proof inside another user’s chat

## Non-negotiable guardrails
These should apply in all modes:

- never reveal secrets, PINs, passwords, tokens, or recovery codes
- never reveal another user’s private conversation history
- never trust identity claims solely from message text
- never perform cross-user messaging/actions without explicit authorization
- keep auditability for cross-user actions if those actions are later supported

## UX / Settings recommendation
Keep the settings understandable, not security-jargon-heavy.

Suggested settings copy:

### Privacy mode
Choose how separate each person’s chats should be.

- **Strict** — Keep chats fully separate. Best for privacy.
- **Balanced** — Allow limited shared household context, but keep private details protected.
- **Trusted household** — Best for close family setups that want more shared context and convenience.

### Advanced settings
- **Share household memory across profiles**: On/Off
- **Allow cross-profile assistant coordination**: Off by default
- **Allow shared reminders/tasks across profiles**: Future capability

Include warning copy for looser modes:
- “Less strict modes may allow the assistant to use limited shared household context across profiles. Private messages, secrets, and credentials remain protected.”

## Implementation notes
Potential technical direction:

- assign each conversation/profile an explicit privacy policy at runtime
- pass resolved policy into the assistant context as structured metadata
- ensure memory systems can distinguish:
  - profile-private memory
  - household-shared memory
- enforce guardrails before model generation where possible, not just by prompt
- for open-source release, ship with conservative defaults and clear docs

## Product opinion
Making this configurable is the right call.

Hardcoding one family-style behavior will create problems once Hearth is used by:
- roommates
- couples
- parents and kids
- small teams
- security-conscious users

The product should let people choose the trust model they actually want.

## Requested next step
Please build on this into a more concrete Hearth proposal covering:
- final policy model
- default settings
- exact UX/settings structure
- technical enforcement approach
- future-safe path for shared household features
