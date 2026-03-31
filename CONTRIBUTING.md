# Contributing to Hearth

Thanks for wanting to help! Hearth is a family project that we're building in the open, and we welcome contributions of all kinds — code, bug reports, ideas, docs, or just honest feedback.

## Getting Started

### Prerequisites
- Node.js 22+
- PostgreSQL 16+
- OpenClaw ([install guide](https://docs.openclaw.ai))

### Dev Setup

```bash
git clone https://github.com/warrence/openclaw-hearth.git
cd openclaw-hearth

# Install dependencies
cd apps/api-nest && npm install && cd ../..
cd apps/web && npm install && cd ../..
cd packages/openclaw-plugin-hearth-app && npm install && cd ../..

# Copy and configure environment
cp apps/api-nest/.env.example apps/api-nest/.env
# Edit .env with your database and OpenClaw details

# Start the API
cd apps/api-nest && npm run build && npm start

# Start the web app (in another terminal)
cd apps/web && npm run dev
```

The web app runs at `http://localhost:9000` with hot reload.

### Project Structure

```
apps/api-nest/    → NestJS backend (TypeScript)
apps/web/         → Vue 3 + Quasar frontend
packages/
  openclaw-plugin-hearth-app/  → OpenClaw channel plugin
  hearth-cli/                  → CLI setup wizard
```

## How to Contribute

### Found a bug?
[Open an issue](https://github.com/warrence/openclaw-hearth/issues/new). Include:
- What happened vs what you expected
- Steps to reproduce
- Browser/OS if it's a frontend issue

### Have an idea?
[Open an issue](https://github.com/warrence/openclaw-hearth/issues/new) and describe what you're thinking. We'd love to discuss it before you invest time building.

### Want to fix something?

1. Fork the repo
2. Create a branch: `git checkout -b fix/short-description`
3. Make your changes
4. Test that it builds: `npm run build` in the relevant package
5. Commit with a clear message: `fix: description of what you fixed`
6. Open a PR against `main`

### Want to add a feature?

Same as above, but please open an issue first so we can discuss the approach. We want to keep Hearth focused and avoid scope creep.

## Conventions

### Branches
- `fix/issue-description` — bug fixes
- `feat/feature-description` — new features
- `docs/what-changed` — documentation

### Commits
We use conventional commits:
- `fix: what was broken`
- `feat: what was added`
- `docs: what was documented`
- `chore: maintenance stuff`

### Code Style
- TypeScript for backend and plugin
- Vue 3 + Composition API for frontend
- Follow existing patterns — consistency over perfection

## What We Value

- **Simple over clever** — readable code wins
- **Small PRs** — easier to review, faster to merge
- **Working software** — if it builds and the existing tests pass, we're happy
- **Honest communication** — if something's unclear, ask

## Questions?

Open an issue or start a discussion. No question is too basic.
