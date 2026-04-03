<p align="center">
  <img src="apps/web/public/brand/hearth-app-master-user-final.png" alt="Hearth" width="120" />
</p>

<h1 align="center">Hearth</h1>

<p align="center">
  <strong>A self-hosted, multi-user household assistant built on <a href="https://github.com/openclaw/openclaw">OpenClaw</a></strong>
</p>

<p align="center">
  Multi-conversation chat · Owner/member permissions · Reminders · HTTPS · Dark theme PWA
</p>

---

## Demo

https://github.com/warrence/openclaw-hearth/raw/main/apps/web/public/brand/hearth-demo.mp4

## Why Hearth?

Every time you switch AI platforms, you start over. Every conversation, every preference, every little thing it learned about your family — gone.

We built Hearth because your family's memories should be **yours forever**. Stored on your own hardware. Under your own control. No matter how many times the AI industry reinvents itself.

**AI keeps getting better every year.** The model you use today will be replaced by something smarter tomorrow. Hearth separates your family's knowledge from the AI that processes it — swap models, switch providers, upgrade whenever. Your memory stays intact.

## Features

- 💬 **Multi-conversation chat** — separate threads by topic, each with independent context
- 👥 **Multi-user household** — each family member gets their own account with private chats
- 🔐 **Owner/member permissions** — owners manage settings, members just chat
- ⏰ **Reminders** — set for yourself or other members, with critical repeats until acknowledged
- 🎨 **Dark theme PWA** — mobile-first, installable, works offline
- ⚡ **Real-time streaming** — token-by-token with stop button
- 🔧 **Model presets** — fast/deep modes, configurable per conversation
- 🔒 **HTTPS** — automatic free certificates via Caddy
- 🖼️ **Attachments** — images, files, and AI image generation
- 🗣️ **Text-to-speech** — read messages aloud

## Quick Start

```bash
# Install
bash <(curl -fsSL https://raw.githubusercontent.com/warrence/openclaw-hearth/main/install.sh)

# Configure your AI provider
openclaw config

# Start the gateway
openclaw gateway start

# Start Hearth
cd ~/hearth && npx hearth start
```

The setup wizard handles everything: Node.js, PostgreSQL, OpenClaw, dependencies, owner account, agent config, HTTPS, and building the app.

> **HTTPS:** During setup, Hearth offers to install [Caddy](https://caddyserver.com) for automatic HTTPS with free Let's Encrypt certificates.

## Updating

```bash
cd ~/hearth
npx hearth update
```

Pulls latest code, checks OpenClaw compatibility, rebuilds, and updates the plugin.

## Architecture

```
Hearth PWA (Vue 3 + Quasar)
        ↓
Hearth API (NestJS)
        ↓
OpenClaw Plugin (hearth-app)
        ↓
OpenClaw Gateway (multi-provider AI)
```

## Manual Setup

```bash
npm install -g openclaw
openclaw config
openclaw gateway start

git clone https://github.com/warrence/openclaw-hearth.git
cd openclaw-hearth
npx hearth setup
npx hearth start
```

## Docker

```bash
git clone https://github.com/warrence/openclaw-hearth.git
cd openclaw-hearth
docker compose up
```

## Configuration

All configuration is handled by `npx hearth setup`. Key environment variables in `apps/api-nest/.env`:

| Variable | Description |
|----------|-------------|
| `OPENCLAW_BASE_URL` | OpenClaw gateway URL |
| `OPENCLAW_GATEWAY_TOKEN` | Gateway auth token |
| `DATABASE_*` | PostgreSQL connection |
| `AUTH_SESSION_SECRET` | Session encryption |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vue 3, Quasar, Vite |
| Backend | NestJS, TypeScript |
| Database | PostgreSQL |
| AI | OpenClaw (multi-provider) |
| Auth | PIN + WebAuthn |
| Real-time | SSE |
| HTTPS | Caddy (optional) |

## Privacy

- All data stays on your hardware
- Each user's conversations are isolated
- No telemetry, no third-party data sharing
- Open source — inspect every line

## Enhance Your Assistant

Add web search, image generation, text-to-speech, long-term memory, and more.

See the **[Enhancement Guide](docs/enhance-your-assistant.md)**.

## Roadmap

- [ ] Privacy modes (household vs private conversations)
- [ ] Household memory model
- [ ] Task system
- [ ] Smart home integrations
- [ ] Expense tracking
- [ ] Health & exercise modules

## Contributing

We're building this in the open. If you care about owning your AI memories, come build with us.

- 💬 [Open an issue](https://github.com/warrence/openclaw-hearth/issues)
- 🔧 [Submit a PR](https://github.com/warrence/openclaw-hearth/pulls)
- 📖 [Contributing guide](CONTRIBUTING.md)

## License

[MIT](LICENSE)

---

<p align="center">
  Built with 🏠 by <a href="https://github.com/warrence">Warrence</a> · Powered by <a href="https://github.com/openclaw/openclaw">OpenClaw</a>
</p>
