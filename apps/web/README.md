# Quasar App (apps-web)

A Quasar Project.

Current UI direction: dark, simple, AI-app feel with a shared app shell for chat and dashboard navigation.

## Install the dependencies

```bash
yarn
# or
npm install
```

### Start the app in development mode (hot-code reloading, error reporting, etc.)

```bash
quasar dev
```

### Lint the files

```bash
yarn lint
# or
npm run lint
```

### Format the files

```bash
yarn format
# or
npm run format
```

### Build the app for production

```bash
quasar build
```

### Optional Nest-backed conversation transport

Laravel remains the default transport. You can opt in to Nest for these conversation endpoints:

- `GET /users/:userId/conversations`
- `GET /conversations/:conversationId`
- `GET /conversations/:conversationId/messages`
- `POST /users/:userId/conversations` for create only
- `PATCH /conversations/:conversationId`
- `POST /conversations/:conversationId/archive`
- `POST /conversations/:conversationId/restore`

Set these env vars in the web app environment **when starting dev** or **when building the PWA bundle**:

```bash
VITE_NEST_READS_ENABLED=true
VITE_NEST_API_BASE_URL=http://127.0.0.1:3001/api
# optional: disable Laravel fallback for the Nest-backed read slice only
VITE_NEST_READS_STRICT=true
# optional: send createConversation() to Nest instead of Laravel
VITE_NEST_CONVERSATION_CREATE_ENABLED=true
# optional: send guarded rename/archive/restore writes to Nest instead of Laravel
VITE_NEST_CONVERSATION_WRITES_ENABLED=true
```

The Nest requests send `x-actor-user-id` from the logged-in Laravel user returned by `/auth/me` or `/auth/login`.

- Create conversation only uses Nest when `VITE_NEST_CONVERSATION_CREATE_ENABLED=true`, `VITE_NEST_API_BASE_URL` is set, and the requested `userId` matches the current actor.
- Rename, archive, and restore only use Nest when `VITE_NEST_CONVERSATION_WRITES_ENABLED=true`, `VITE_NEST_API_BASE_URL` is set, and the current actor id is available.
- If actor bootstrap fails before a guarded write starts, the web app keeps the Laravel path instead of attempting an invalid Nest request.
- Once a guarded write is routed to Nest, failures are surfaced directly and are **not** replayed to Laravel.

Attachment upload, message send/streaming, and every other write still stay on Laravel.

With `VITE_NEST_READS_STRICT=true`, only the current Nest-backed read slice changes behavior:

- conversation list
- conversation detail
- messages list

In strict mode, a Nest read error, response-shape mismatch, or suspicious empty conversation list result is surfaced directly instead of falling back to Laravel. This does not change write behavior.

For the first write test, `createConversation()` is different by design: when Nest create is enabled, a failed Nest `POST /users/:userId/conversations` is surfaced directly and is **not** replayed to Laravel. That avoids duplicate creates after ambiguous Nest failures.

Important for PWA/prod testing: these `VITE_*` values are compiled into `dist/pwa` at build time. Setting them only on `node scripts/pwa-prod-server.mjs` later will **not** switch an already-built bundle.

Quick test:

```bash
# dev mode with Nest-backed reads enabled
VITE_NEST_READS_ENABLED=true \
VITE_NEST_API_BASE_URL=http://127.0.0.1:3001/api \
npm run dev:pwa

# dev mode with strict Nest read testing
VITE_NEST_READS_ENABLED=true \
VITE_NEST_API_BASE_URL=http://127.0.0.1:3001/api \
VITE_NEST_READS_STRICT=true \
npm run dev:pwa

# dev mode with Nest-backed create conversation enabled
VITE_NEST_READS_ENABLED=true \
VITE_NEST_API_BASE_URL=http://127.0.0.1:3001/api \
VITE_NEST_CONVERSATION_CREATE_ENABLED=true \
npm run dev:pwa

# dev mode with guarded Nest rename/archive/restore writes enabled
VITE_NEST_READS_ENABLED=true \
VITE_NEST_API_BASE_URL=http://127.0.0.1:3001/api \
VITE_NEST_CONVERSATION_WRITES_ENABLED=true \
npm run dev:pwa

# PWA build with Nest-backed reads enabled
VITE_NEST_READS_ENABLED=true \
VITE_NEST_API_BASE_URL=http://127.0.0.1:3001/api \
npm run build:pwa

# PWA build with strict Nest read testing
VITE_NEST_READS_ENABLED=true \
VITE_NEST_API_BASE_URL=http://127.0.0.1:3001/api \
VITE_NEST_READS_STRICT=true \
npm run build:pwa

# PWA build with Nest-backed create conversation enabled
VITE_NEST_READS_ENABLED=true \
VITE_NEST_API_BASE_URL=http://127.0.0.1:3001/api \
VITE_NEST_CONVERSATION_CREATE_ENABLED=true \
npm run build:pwa

# PWA build with guarded Nest rename/archive/restore writes enabled
VITE_NEST_READS_ENABLED=true \
VITE_NEST_API_BASE_URL=http://127.0.0.1:3001/api \
VITE_NEST_CONVERSATION_WRITES_ENABLED=true \
npm run build:pwa

# rollback / rebuild back to Laravel-only conversation traffic
VITE_NEST_READS_ENABLED=false \
VITE_NEST_CONVERSATION_CREATE_ENABLED=false \
VITE_NEST_CONVERSATION_WRITES_ENABLED=false \
npm run build:pwa
```

After enabling, log in through Laravel as usual and confirm the browser network tab behavior:

- reads above go to Nest only when `VITE_NEST_READS_ENABLED=true`
- new chat create goes to Nest only when `VITE_NEST_CONVERSATION_CREATE_ENABLED=true`
- rename, archive, and restore go to Nest only when `VITE_NEST_CONVERSATION_WRITES_ENABLED=true`
- attachment upload, message send/streaming, and every other write still go to Laravel

Recommended first write test:

1. Build or start the app with `VITE_NEST_CONVERSATION_CREATE_ENABLED=true`.
2. Log in through Laravel as usual.
3. Click **New chat** and confirm `POST /users/:userId/conversations` goes to Nest with `x-actor-user-id`.
4. Verify the returned conversation opens normally and the sidebar/detail/messages reads still follow the current read flags.
5. Disable `VITE_NEST_CONVERSATION_CREATE_ENABLED` and rebuild to roll back create traffic to Laravel immediately.

### Customize the configuration

See [Configuring quasar.config.js](https://v2.quasar.dev/quasar-cli-vite/quasar-config-js).
