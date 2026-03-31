# Hearth Actions Spec

**Status:** Draft  
**Version:** 0.1  
**Date:** 2026-03-28  

---

## Overview

Hearth Actions is the contract between Aeris (the AI agent) and the Hearth platform for triggering structured operations — reminders, expense logging, health tracking, smart home commands, and any future module.

Instead of injecting large module descriptions into the agent's context, Aeris uses a compact **action block** in her reply. Hearth Nest parses and executes it.

---

## The Contract

### Agent output format

Aeris replies with natural text. When a Hearth feature should be triggered, she appends a JSON action block wrapped in a fenced code block:

```
Sure! I'll remind you to drink water in 5 minutes. 💧

```hearth-action
{"type":"reminder","fire_at":"2026-03-28T22:37:00+08:00","text":"Drink water"}
```
```

The action block is **stripped from the displayed message** — users only see the natural text.

### Multiple actions

```hearth-action
[
  {"type":"reminder","fire_at":"2026-03-29T09:00:00+08:00","text":"Morning run"},
  {"type":"reminder","fire_at":"2026-03-29T18:00:00+08:00","text":"Evening walk"}
]
```

---

## Module Action Schemas

### `reminder`
```json
{
  "type": "reminder",
  "fire_at": "ISO8601 datetime with timezone",
  "text": "What to remind about",
  "repeat": "none | daily | weekly"  // optional, default: none
}
```

### `expense` _(future)_
```json
{
  "type": "expense",
  "amount": 15.50,
  "currency": "MYR",
  "category": "food | transport | utilities | health | entertainment | other",
  "description": "Lunch at mamak",
  "date": "ISO8601 date"  // optional, default: now
}
```

### `health_log` _(future)_
```json
{
  "type": "health_log",
  "metric": "calories | weight | steps | water | sleep | custom",
  "value": 500,
  "unit": "kcal | kg | steps | ml | hours | custom",
  "note": "Nasi lemak + teh tarik"  // optional
}
```

### `smart_home` _(future)_
```json
{
  "type": "smart_home",
  "command": "turn_on | turn_off | set_temperature | lock | unlock",
  "device": "living_room_lights | ac | front_door | ...",
  "value": 22  // optional, for set_temperature etc.
}
```

### `task` _(future)_
```json
{
  "type": "task",
  "operation": "create | complete | assign",
  "title": "Buy groceries",
  "assignee": "alex | sam | kid",  // optional
  "due_date": "ISO8601 date"  // optional
}
```

---

## Capability Manifest (what Aeris gets injected)

Instead of full module docs, Aeris receives a compact manifest. This is injected into the inbound dispatch context by the Hearth plugin — updated as modules are enabled.

**Current manifest (injected per message):**

```
[Hearth capabilities]
When you want to trigger a Hearth feature, append a fenced ```hearth-action``` block with JSON.
The block is hidden from the user — only your text reply is shown.

Available actions:
- reminder: {"type":"reminder","fire_at":"<ISO8601+tz>","text":"<what to remind>"}
  Triggers a push notification at the specified time.
```

**Future manifest (as modules are added):**

```
[Hearth capabilities]
Append a ```hearth-action``` JSON block to trigger features. Hidden from user.

Available:
- reminder: {"type":"reminder","fire_at":"<ISO8601+tz>","text":"...","repeat":"none|daily|weekly"}
- expense: {"type":"expense","amount":<num>,"currency":"MYR","category":"food|transport|...","description":"..."}
- health_log: {"type":"health_log","metric":"calories|weight|water|sleep","value":<num>,"unit":"..."}
- task: {"type":"task","operation":"create|complete","title":"...","assignee":"...","due_date":"..."}
```

At 20 modules this manifest stays under ~2000 tokens — well within budget.

---

## Nest Processing

### 1. Strip and parse
`ConversationAssistantExecutionService` strips `hearth-action` blocks from the message content before saving, and passes parsed actions to `HeartheActionProcessorService`.

### 2. Action processor
`HeartheActionProcessorService` routes each action to the appropriate module service:
- `reminder` → `RemindersService.scheduleReminder()`
- `expense` → `ExpensesService.logExpense()` _(future)_
- etc.

### 3. Error handling
If an action fails, it's logged silently — the message still saves normally. User sees the text reply; action failure is surfaced separately if needed.

---

## Migration from regex parsing

The current reminder system uses regex on Aeris's output. Once the actions contract is in place:

1. Update the Hearth plugin to inject the capability manifest
2. Update Nest to parse `hearth-action` blocks
3. Deprecate the regex fallback (keep it briefly for transition)
4. Remove regex parser once Aeris is consistently using action blocks

---

## Implementation order

| Phase | What | When |
|-------|------|------|
| 0 (now) | Regex parsing of reminder text | Done ✅ |
| 1 | `hearth-action` block parsing in Nest | Next session |
| 1 | Capability manifest injected by plugin | Next session |
| 1 | Reminder migrated to action blocks | Next session |
| 2 | Expense module | Wave 2 |
| 2 | Health log module | Wave 2 |
| 3 | Smart home module | Wave 3 |
