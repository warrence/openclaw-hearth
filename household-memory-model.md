# Household Memory Model — Hearth

## Purpose
This document defines the intended memory philosophy for Hearth as a home assistant system.

The goal is not to treat Hearth like a standard SaaS app with rigidly isolated user silos by default.
The goal is to build Hearth more like a trustworthy household assistant:
- aware of the home as a shared environment
- aware of individual people within that home
- capable of remembering useful household context
- capable of respecting privacy, sensitivity, and explicit secrecy

---

## Core Product Stance
Hearth should become a **household-aware assistant with social boundaries**.

That means Hearth should eventually support:
- shared household context
- personal per-user context
- confidential/secret context

This is stronger than a simple "private vs shared" toggle model.

---

## Why this model
In a real home, many things are naturally shared:
- birthdays
- family events
- routines
- groceries
- travel plans
- household preferences
- school dates
- appointments relevant to the family
- issues around the house

If Hearth keeps all memory locked inside individual user silos, it may feel safe but unnaturally dumb.

At the same time, not everything should be shared:
- surprises
- secrets
- sensitive personal matters
- one-to-one private discussions
- emotionally delicate context

So the right design is not:
- everything private by default forever
- or everything shared by default carelessly

The right design is:
**household-aware memory with confidentiality rules**.

---

## Memory Types

### 1) Household knowledge
Information that Hearth may use across household interactions when relevant.

Examples:
- upcoming family events
- birthday dates
- grocery needs
- family travel plans
- household routines
- shared preferences
- home maintenance facts

### 2) Personal knowledge
Information mainly about one person and usually most relevant in that person's own context.

Examples:
- preferred reminder style
- favorite foods
- personal habits
- individual chat preferences
- personal projects or plans

Personal does not always mean secret.
It means use should be more careful and context-sensitive.

### 3) Confidential knowledge
Information Hearth should protect from other household members unless permission is given.

Examples:
- surprises
- explicitly secret plans
- private concerns
- sensitive conversations
- "don't tell anyone"
- "don't mention this to X"

This category is critical for trust.

---

## Key Questions Hearth should eventually answer internally
When Hearth receives or recalls a memory, it should eventually reason about:

1. **Who told me this?**
2. **Who is this about?**
3. **Is this ordinary household knowledge, personal context, or confidential?**
4. **Who may know this?**
5. **Who may not know this?**
6. **May I use this in another conversation?**
7. **Should this be retained long-term or stay conversation-local?**

This is a social memory model, not just a storage model.

---

## Explicit secrecy and trust signals
Hearth should eventually treat phrases like these as strong signals:
- don't tell anyone
- keep this secret
- between us only
- don't mention this to Sam
- don't tell Kid
- this is private
- this is a surprise

When such signals are present, Hearth should prefer confidentiality over convenience.

Trust is more important than clever cross-user recall.

---

## Example: birthday planning
If Sam says:
> I'm planning Kid's birthday party for next month.

Possible memory handling:

### Household-appropriate
- Kid has a birthday coming up next month.
- There is an upcoming family event related to Kid's birthday.

### Personal / role-specific
- Sam is currently coordinating birthday planning.

### Confidential if indicated or inferred
- surprise details
- guest list
- budget
- gifts
- "don't mention the surprise to Kid"

Hearth should not flatten all of this into one memory blob.
It should eventually preserve different visibility levels.

---

## Product principles

### 1) Household-aware by default in philosophy
Hearth is not meant to behave like unrelated user accounts living in the same database.
It is meant to behave like one household assistant that understands people and relationships inside a shared home.

### 2) Confidentiality over convenience
If there is ambiguity between being helpful and protecting trust, Hearth should protect trust.

### 3) Do not force premature automation
Shared memory promotion and confidentiality inference should be introduced carefully.
Early implementations should prefer clear rules over magical behavior.

### 4) Preserve explainability
When Hearth uses shared household context, the behavior should feel understandable, not creepy or random.

---

## Suggested implementation stages

### Stage 1 — Strong identity boundaries first
Before advanced shared memory behavior:
- add proper login/auth
- enforce per-user access boundaries
- confirm per-user conversation/session isolation
- establish role-ready architecture

This stage is about trust foundations.

### Stage 2 — Introduce memory visibility concepts
Add explicit memory visibility categories in architecture and storage design, such as:
- household
- personal
- confidential
- conversation-local

This does not require full automation yet.

### Stage 3 — Controlled shared-memory behavior
Allow Hearth to use household knowledge across users where clearly appropriate.
Start with obvious, low-risk domains:
- household events
- groceries
- shared plans
- reminders
- home operations

### Stage 4 — Smart confidentiality handling
Allow Hearth to detect or respect:
- explicit secrecy instructions
- per-person exclusions
- surprise/sensitive contexts
- safe non-disclosure across household members

### Stage 5 — Mature household social memory
Long-term, Hearth should behave more like a real household assistant that knows:
- what is generally shared
- what is person-specific
- what is confidential
- when to keep quiet

---

## Architectural direction
The future model should distinguish at least these dimensions:

### Identity
Who is speaking right now?

### Subject
Who is this memory about?

### Visibility
Who may know or use this information?

### Confidentiality
Is this secret, sensitive, or restricted?

### Context scope
May it be used in:
- same-person conversation only
- household-wide conversations
- specific-people-only contexts
- general household planning contexts

---

## Immediate design implication for Wave 1
Wave 1 should still prioritize:
1. auth / PIN login
2. role-ready user model
3. strong per-user access enforcement

But those should be designed in a way that does **not** assume the final product is only private per-user silos.

The architecture should remain compatible with:
- household-shared memory
- confidential memory rules
- future multi-user and subscription evolution

---

## Summary
Hearth should aim to become:

**a household-aware assistant with social boundaries, not just isolated user accounts**

That means the long-term memory model should support:
- household knowledge
- personal knowledge
- confidential knowledge
- visibility and secrecy rules

This is the direction that best matches Hearth's long-term role as a real home assistant.
