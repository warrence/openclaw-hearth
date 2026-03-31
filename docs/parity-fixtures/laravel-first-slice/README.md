# Laravel first-slice parity fixtures

These fixtures were captured from the current Laravel API test harness using real routes/controllers and mocked gateway responses only where the app depends on external OpenClaw health/streaming calls.

## Captured artifacts

- `gateway-status.json` — `GET /api/gateway/status`
- `conversation-list.active.json` — `GET /api/users/{user}/conversations?scope=active`
- `conversation-list.search.json` — `GET /api/users/{user}/conversations?search=tokyo`
- `conversation-detail.json` — `GET /api/conversations/{conversation}`
- `messages-list.json` — `GET /api/conversations/{conversation}/messages`
- `message-stream.raw.sse` — raw SSE bytes from `POST /api/conversations/{conversation}/messages` with `Accept: text/event-stream`
- `message-stream.events.json` — parsed SSE event envelopes in emitted order

## Why these are grounded

- Response shapes come from the current Laravel controllers and Eloquent serialization.
- Search fixture includes the current `search_match` structure used by the web sidebar.
- Message fixtures preserve persisted app-channel fields such as `contract_event`, `channel_message_id`, `reply_to_message_id`, `metadata_json`, and `contract_json`.
- SSE fixtures reflect the event names and payload fields the web client parser handles today: `message.created`, `assistant.placeholder`, `status`, `assistant.delta`, `assistant.message`, and `done`.

## How to use for NestJS parity

1. Recreate the same scenario in NestJS.
2. Compare endpoint JSON bodies against these fixtures field-for-field.
3. Compare SSE event order and envelope keys against `message-stream.events.json`.
4. Treat these as parity fixtures for the first migration slice; if Laravel contracts intentionally change later, refresh the fixtures and update downstream tests together.