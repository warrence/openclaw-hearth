<p align="center">
  <img src="apps/web/public/brand/hearth-app-master-user-final.png" alt="Hearth" width="120" />
</p>

<h1 align="center">Hearth</h1>

<p align="center">
  <strong>A self-hosted, multi-user household assistant built on <a href="https://github.com/openclaw/openclaw">OpenClaw</a></strong>
</p>

<p align="center">
  Multi-conversation chat · Owner/member permissions · Reminders across household members · Dark theme PWA
</p>

---

## Demo

<video src="https://github.com/warrence/openclaw-hearth/raw/main/apps/web/public/brand/hearth-demo.mp4" width="300" autoplay loop muted playsinline></video>

## Why Hearth?

Every time you switch AI platforms, you start over. Every conversation, every preference, every little thing it learned about your family — gone. Your memories don't belong to you. They belong to whichever company you're renting this month.

We built Hearth because we believe your family's memories should be **yours forever**.

Not locked inside any platform. Not lost when the next big model drops and everyone migrates again. Your conversations, your context, your history — stored on your own hardware, under your own control, for as long as you want to keep them.

And here's what makes that powerful: **AI keeps getting better every year.** The model you use today will be replaced by something smarter tomorrow. But your memories don't have to reset with it. Hearth separates your family's knowledge from the AI that processes it. Swap models, switch providers, upgrade to whatever comes next — your household's memory stays intact.

Imagine ten years of family conversations. A decade of preferences, inside jokes, health notes, recipes your kids loved, reminders that mattered. All of it still there, still accessible, still growing — no matter how many times the AI industry reinvents itself.

That's what Hearth is for. **A home for your family's AI memory that outlasts any single platform.**

### What Hearth gives you

- **Your memory, your hardware** — all conversations and context stored locally, never sent to third parties
- **Model-independent** — switch AI providers anytime without losing a single conversation
- **Multi-user households** — each family member gets their own account with separate, private chats
- **Real home use** — reminders, cross-member notifications, critical alerts that repeat until acknowledged
- **Future-proof** — as AI grows smarter, your family's accumulated knowledge grows with it
- **Open source** — inspect, modify, and own every line of code that touches your family's data

## Features

### 💬 Multi-Conversation Chat
Create multiple separate conversations with independent history and context. Organize by topic — morning routines, meal planning, research, reminders.

### 👥 Multi-User Household
Each household member gets their own profile with PIN authentication. Conversations are isolated per user.

### 🔐 Role-Based Permissions
- **Owner** — full access to settings, OpenClaw configuration, and system management
- **Member** — chat only; cannot view or modify system settings, API keys, or infrastructure details

### ⏰ Reminders
- Set reminders for yourself or other household members
- **Critical reminders** repeat every minute until acknowledged
- Cross-member reminders create a fresh chat in the target user's account

### 🎨 Modern Dark UI
- Purple-blue gradient theme
- Mobile-first PWA design
- Real-time token streaming
- Markdown rendering with code blocks
- Image attachments and generation
- Text-to-speech playback

### ⚡ Real-Time Streaming
- Token-by-token streaming via SSE
- Stop button with real abort
- Tool/status indicators during processing
- Background sync across devices

### 🔧 Model Presets
- **Fast** and **Deep** modes per conversation
- Configurable models, thinking levels, and reasoning via dashboard

## Architecture

```
┌──────────────────────────────────────────────┐
│                  Hearth PWA                   │
│            Vue 3 + Quasar Framework           │
│        (mobile-first dark theme UI)           │
└──────────────────┬───────────────────────────┘
                   │
┌──────────────────▼───────────────────────────┐
│              Hearth API (NestJS)              │
│  Auth · Conversations · Messages · Reminders  │
│  Attachments · Push · Settings · SSE Events   │
└──────────────────┬───────────────────────────┘
                   │
┌──────────────────▼───────────────────────────┐
│         OpenClaw Plugin (hearth-app)          │
│    Session routing · Capability manifest      │
│    Role policy injection · Stream callbacks   │
└──────────────────┬───────────────────────────┘
                   │
┌──────────────────▼───────────────────────────┐
│            OpenClaw Gateway                   │
│     Agent orchestration · Model routing       │
│     Memory · Tools · Multi-provider AI        │
└──────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites
- **Node.js** 22+
- **PostgreSQL** 16+
- **OpenClaw** ([install guide](https://docs.openclaw.ai))

### Setup

```bash
git clone https://github.com/user/hearth.git
cd hearth
npx hearth setup
```

That's it. The setup wizard will:
1. Install all dependencies automatically
2. Connect to PostgreSQL and create the schema
3. Detect or install OpenClaw
4. Create your owner account
5. Configure the agent
6. Generate the `.env` file
7. Build the web app

### Start

```bash
npx hearth start
```

Open `http://localhost:9100` in your browser.

### Docker

```bash
git clone https://github.com/user/hearth.git
cd hearth
docker compose up
```

The database schema is created automatically on first boot. Open `http://localhost:9100`.

## Project Structure

```
hearth/
├── apps/
│   ├── api-nest/          # NestJS backend API
│   │   └── src/
│   │       ├── auth/      # PIN auth, sessions, WebAuthn
│   │       ├── conversations/  # Chat, messages, streaming
│   │       ├── reminders/     # Scheduler + critical repeats
│   │       ├── push/          # Web push notifications
│   │       └── settings/      # Dashboard config API
│   │
│   └── web/               # Vue 3 + Quasar PWA frontend
│       ├── src/
│       │   ├── pages/     # Main chat UI
│       │   ├── layouts/   # Navigation, drawer, chat list
│       │   └── components/settings/  # Dashboard settings
│       └── public/
│           └── brand/     # Logo and icon assets
│
├── packages/
│   ├── openclaw-plugin-hearth-app/  # OpenClaw channel plugin
│   └── hearth-cli/                  # CLI setup wizard
│
└── docker-compose.yml
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENCLAW_BASE_URL` | OpenClaw gateway URL | `http://127.0.0.1:18789` |
| `OPENCLAW_GATEWAY_TOKEN` | Gateway authentication token | — |
| `DATABASE_HOST` | PostgreSQL host | `127.0.0.1` |
| `DATABASE_PORT` | PostgreSQL port | `5432` |
| `DATABASE_NAME` | Database name | `hearth` |
| `DATABASE_USER` | Database user | `hearth` |
| `DATABASE_PASSWORD` | Database password | — |
| `AUTH_SESSION_SECRET` | Session encryption secret (16+ chars) | — |
| `PORT` | API server port | `3001` |

### OpenClaw Plugin

The `openclaw-plugin-hearth-app` package bridges Hearth and OpenClaw. Install it as an OpenClaw plugin:

```bash
openclaw plugins install packages/openclaw-plugin-hearth-app
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vue 3, Quasar Framework, Vite |
| Backend | NestJS, TypeScript |
| Database | PostgreSQL |
| AI Engine | OpenClaw (multi-provider) |
| Auth | PIN + WebAuthn (passkeys) |
| Real-time | Server-Sent Events (SSE) |
| Notifications | Web Push API |
| Deployment | Docker, PWA |

## Privacy & Security

Hearth is designed with household privacy in mind:

- **User isolation** — each user's conversations are separate
- **Role-based access** — members cannot access system settings or OpenClaw configuration
- **Self-hosted** — all data stays on your hardware
- **No telemetry** — no data sent to third parties
- **PIN + WebAuthn** — local authentication with optional biometrics

## Roadmap

- [ ] Privacy modes (household vs private conversations)
- [ ] Household memory model (shared vs personal knowledge)
- [ ] Task system (beyond reminders)
- [ ] Smart home integrations
- [ ] Expense tracking
- [ ] Health & exercise modules

## Join Us

Hearth is early, and we're building it in the open because we believe this should exist for everyone — not just our family.

If you care about **owning your AI memories**, if you've felt the frustration of starting over every time a new model comes out, if you think families deserve better than renting intelligence from a platform that could change its terms tomorrow — we'd love your help.

Whether you're a frontend dev who wants to make the UI smoother, a backend dev who can harden the API, a designer who sees a better way to organize household conversations, or someone who just wants to self-host and file honest bug reports — **you're welcome here.**

This isn't a corporation. It's a family project that grew into something we think other families need too. Come build with us.

- 💬 [Open an issue](https://github.com/warrence/openclaw-hearth/issues) — bugs, ideas, questions
- 🔧 [Submit a PR](https://github.com/warrence/openclaw-hearth/pulls) — fixes, features, docs
- 📖 [Read the contributing guide](CONTRIBUTING.md)

## License

[MIT](LICENSE)

---

<p align="center">
  Built with 🏠 by <a href="https://github.com/user">Warrence</a>
  <br/>
  Powered by <a href="https://github.com/openclaw/openclaw">OpenClaw</a>
</p>
