<p align="center">
  <img src="apps/web/public/brand/hearth-app-master-user-final.png" alt="Hearth" width="120" />
</p>

<h1 align="center">Hearth</h1>

<p align="center">
  <strong>A self-hosted household AI chat app built on <a href="https://github.com/openclaw/openclaw">OpenClaw</a></strong>
</p>

<p align="center">
  Designed for multiple conversations, multi-user family life, private chats, and long-term memory that can stay with your household over time.
</p>

<p align="center">
  <strong>⚠️ Early Release — Use at your own risk</strong><br/>
  <sub>Hearth is under active development. Features may change, break, or disappear between updates.<br/>
  Not recommended for production use yet. Back up your data regularly.</sub>
</p>

---

## Why Hearth?

Most AI products are built for a single user.

But real life at home is not single-user. Families have separate conversations, shared context, different privacy needs, and long-term history that may become increasingly valuable as AI becomes more integrated into daily life.

Hearth is an attempt to build that household layer.

Built on top of OpenClaw, Hearth turns self-hosted AI into a family-ready chat system with multiple conversations, multi-user access, private chats, reminders, and long-term memory designed to stay on hardware you control.

The long-term idea is simple:

**if AI becomes part of everyday family life, the memory and context a household builds with it should belong to that household.**

## What Hearth is today

Today, Hearth is focused on becoming a dependable household AI chat experience with:

- **multiple chat conversations** for separate topics and ongoing threads
- **multi-user household support** so each family member has their own account
- **private chats and role-aware access**
- **self-hosted deployment** with your data on your own hardware
- **OpenClaw-powered intelligence** as the underlying AI layer
- **reminders and assistant workflows**
- **mobile-first PWA design** for daily use

## Demo

<p align="center">
  <img src="apps/web/public/brand/hearth-demo.gif" alt="Hearth Demo" width="300" />
</p>

## Features

- 💬 **Multiple conversations** — separate chats by topic, each with independent context
- 👥 **Multi-user household support** — each family member gets their own account
- 🔐 **Private chats and role-ready access** — designed for owner/member household use
- ⏰ **Reminders** — set for yourself or other household members
- 🧠 **Long-term memory direction** — built around the idea that household context should compound over time
- 🎨 **Dark theme PWA** — mobile-first, installable, works offline
- ⚡ **Real-time streaming** — token-by-token replies with stop support
- 🔧 **Model presets** — configurable response modes per conversation
- 🖼️ **Attachments** — images, files, and AI image generation
- 🗣️ **Text-to-speech** — read messages aloud
- 🔒 **Self-hosted with HTTPS support** — keep control of your own deployment

## Why follow this project?

Hearth is not just another chat wrapper.

It is building toward a self-hosted household AI product where:

- multiple family members can use the same system in a structured way
- conversations can stay separated while household context grows over time
- long-term memory belongs to the household, not to a platform
- OpenClaw powers a real end-user product layer, not just a developer-facing core

If you care about self-hosted AI, household-scale assistants, and long-term memory that compounds instead of resetting, this project is worth watching.

## Quick Start

```bash
# Install
bash <(curl -fsSL https://raw.githubusercontent.com/warrence/openclaw-hearth/main/install.sh)

# Configure your AI provider
openclaw config

# Start the gateway
openclaw gateway start

# Install as background service (auto-start on boot)
cd ~/hearth && npx hearth install-service
```

The setup wizard handles everything: Node.js, PostgreSQL, OpenClaw, dependencies, owner account, agent config, HTTPS, and building the app. The service installer configures **systemd** (Linux) or **launchd** (macOS) so Hearth starts automatically on boot.

> **HTTPS:** During setup, Hearth offers to install [Caddy](https://caddyserver.com) for automatic HTTPS with free Let's Encrypt certificates.

## Updating

```bash
cd ~/hearth
npx hearth update
```

Pulls latest code, checks OpenClaw compatibility, rebuilds, and updates the plugin.

## Architecture

Hearth uses OpenClaw as the self-hosted AI core and adds the household-facing product layer on top.

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

- Your data stays on hardware you control
- Household use is first-class, not an afterthought
- Private chats and structured access matter
- No telemetry, no third-party data sharing
- Open source — inspect every line

## Enhance Your Assistant

Add web search, image generation, text-to-speech, long-term memory, and more.

See the **[Enhancement Guide](docs/enhance-your-assistant.md)**.

## Roadmap

Hearth starts as a household AI chat system and is intended to grow into a broader home and lifestyle assistant platform.

- [ ] Privacy modes (household vs private conversations)
- [ ] Household memory model
- [ ] Task system
- [ ] Smart home integrations
- [ ] Expense tracking
- [ ] Health & exercise modules

## Contributing

We're building this in the open. If you care about self-hosted AI, household-scale assistants, and long-term memory that belongs to the people using it, come build with us.

- 💬 [Open an issue](https://github.com/warrence/openclaw-hearth/issues)
- 🔧 [Submit a PR](https://github.com/warrence/openclaw-hearth/pulls)
- 📖 [Contributing guide](CONTRIBUTING.md)

## License

[MIT](LICENSE)

---

<p align="center">
  Built with 🏠 by <a href="https://github.com/warrence">Warrence</a> · Powered by <a href="https://github.com/openclaw/openclaw">OpenClaw</a>
</p>
