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

https://github.com/warrence/openclaw-hearth/raw/main/apps/web/public/brand/hearth-demo.mp4

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

### One-Line Install (macOS / Linux)

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/warrence/openclaw-hearth/main/install.sh)
```

This automatically detects and installs everything you need:
- **git** — clones the repo
- **Node.js 22** — via nvm
- **PostgreSQL 16** — local install or Docker container
- **OpenClaw** — detected or installed during setup
- **All dependencies** — npm install for all packages

Then runs the interactive setup wizard to configure your owner account, agent, and database.

### Configure OpenClaw

After install, configure OpenClaw with your AI provider and start the gateway:

```bash
# Set up your AI provider (interactive — adds API keys, model defaults, etc.)
openclaw config

# Start the OpenClaw gateway
openclaw gateway start
```

> Hearth talks to OpenClaw for all AI capabilities. The gateway must be running before you start Hearth.

### Start Hearth

```bash
cd ~/hearth
npx hearth start
```

Open `http://localhost:9100` in your browser.

### HTTPS with Caddy (Recommended)

The setup wizard can automatically configure [Caddy](https://caddyserver.com) as an HTTPS reverse proxy with **free automatic certificates** from Let's Encrypt.

During setup, Hearth will:
- Detect your public IP and hostname
- Offer to install Caddy if not present
- Generate a Caddyfile
- Start Caddy with auto-HTTPS

```
🌐  Network & HTTPS

  → Public IP detected: 54.123.45.67
  ? Set up HTTPS with Caddy? Yes
  ? Which address should Hearth use? yourdomain.com
  ? HTTPS port: 443

  ✓ Hearth will be available at: https://yourdomain.com
```

If you already have Hearth installed, you can set up Caddy manually:

```bash
# Install Caddy
sudo apt install -y caddy   # Debian/Ubuntu
brew install caddy           # macOS

# Create a Caddyfile
cat > ~/hearth/Caddyfile << 'EOF'
yourdomain.com {
  handle /api/* {
    reverse_proxy localhost:3001
  }
  handle /storage/* {
    reverse_proxy localhost:3001
  }
  handle {
    reverse_proxy localhost:9100
  }
}
EOF

# Start Caddy
caddy start --config ~/hearth/Caddyfile
```

> **Note:** For Let's Encrypt to work, your domain must point to your server's public IP and port 443 must be open. For IP-only setups, Caddy uses self-signed certificates.

### Updating

```bash
cd ~/hearth
npx hearth update
```

This pulls the latest code, checks OpenClaw compatibility, rebuilds everything, and updates the plugin.

### Manual Setup

If you prefer to install prerequisites yourself:

```bash
# 1. Install OpenClaw
npm install -g openclaw
openclaw config          # Set up your AI provider
openclaw gateway start   # Start the gateway

# 2. Clone and set up Hearth
git clone https://github.com/warrence/openclaw-hearth.git
cd openclaw-hearth
npx hearth setup
npx hearth start
```

### Docker

```bash
git clone https://github.com/warrence/openclaw-hearth.git
cd openclaw-hearth
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

## Enhance Your Assistant

Once Hearth is running, you can add more capabilities:

- 🔍 **Web search** — let your assistant look things up online
- 🎨 **Image generation** — create and edit images
- 🗣️ **Text-to-speech** — read messages aloud
- 🧠 **Long-term memory** — remember things across conversations
- 📚 **Skills** — self-improvement, weather, and more

See the **[Enhancement Guide](docs/enhance-your-assistant.md)** for step-by-step setup.

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
  Built with 🏠 by <a href="https://github.com/warrence">Warrence</a>
  <br/>
  Powered by <a href="https://github.com/openclaw/openclaw">OpenClaw</a>
</p>
