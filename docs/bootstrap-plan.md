# Bootstrap Plan

## What exists now

- Laravel app scaffold in `apps/api`
- Quasar app scaffold in `apps/web`
- Project-shaped API/data model foundation
- MVP frontend shell with profile picker, chat list, conversation view, and dashboard placeholder

## Next commands

### Backend
```bash
cd apps/api
php artisan migrate:fresh --seed
php artisan route:list
php artisan serve
```

### Frontend
```bash
cd apps/web
npm install
# Optional when your Laravel API is not on http://127.0.0.1:8000:
# export VITE_API_BASE_URL=http://127.0.0.1:8000/api
npm run dev
npm run build
```

## Backend integration status

Implemented in `apps/api`:

- `OpenClawGatewayClient` service using the local `openclaw` CLI as the gateway bridge
- real gateway health checks
- real agent message execution bound to conversation session keys
- SSE lifecycle events from `POST /api/conversations/{conversation}/messages`

## Frontend integration status

Completed:
- Quasar shell now uses the real Laravel API for profiles, conversations, messages, and gateway status.
- Chat composer posts to the real SSE message endpoint.
- SSE lifecycle + progress events now drive in-chat status states, pending assistant placeholders, elapsed timers, and final assistant message rendering.

## Exact verification steps

### Backend
```bash
cd apps/api
php artisan migrate:fresh --seed
php artisan test
php artisan serve
```

### Frontend
```bash
cd apps/web
npm install
npm run build
npm run dev
```

## Current limitation

True token-by-token streaming still is not exposed through the current `openclaw gateway call agent --expect-final` CLI path.

## Next coding step

Probe a lower-level OpenClaw event stream / WebSocket route that can expose real partial assistant deltas to Laravel without replacing the current working vertical slice.
