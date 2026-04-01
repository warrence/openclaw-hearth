# Long-Term Memory Setup

## Why Memory Matters for Hearth

Without memory, your assistant starts fresh every conversation. It won't remember:
- Your family members' names and preferences
- That your kid is allergic to peanuts
- That you prefer your coffee black
- The recipe you loved last week
- That you already asked about car insurance yesterday

With memory, your assistant **grows with your family**. Over months and years, it builds a deep understanding of your household — and because Hearth is self-hosted, that knowledge stays yours forever.

## Memory Options

Hearth works with OpenClaw's memory system. There are three levels, from simplest to most powerful:

### 1. Built-in Memory (works out of the box)

**No setup needed.** This is active by default.

OpenClaw stores memories as simple Markdown files in the agent's workspace:
- `MEMORY.md` — long-term facts and preferences
- `memory/YYYY-MM-DD.md` — daily notes and context

Your assistant can read and write these files naturally. Just say:
- "Remember that Sam is allergic to peanuts"
- "What do you remember about our dinner preferences?"

**Pros:** Zero setup, fully private, easy to read/edit yourself
**Cons:** No semantic search (keyword only), doesn't scale to thousands of memories

### 2. Memory-Core with Semantic Search

If you have an AI API key configured (OpenAI, Google, etc.), OpenClaw automatically enables **semantic search** on your memory files. This means:
- "What does Sam like to eat?" finds "Sam's favorite food is pizza" even though the words don't match
- Works with the built-in Markdown files — no extra setup

**To verify it's working:**
```bash
openclaw status
```
Look for `memory: hybrid (keyword + vector)` in the output.

### 3. Mem0 — Enhanced Persistent Memory (Recommended)

[Mem0](https://github.com/mem0ai/mem0) adds a more sophisticated memory layer:
- **Automatic memory extraction** — the assistant remembers important facts without being asked
- **Semantic search** — finds relevant memories by meaning, not just keywords
- **Memory deduplication** — won't store the same fact twice
- **User-scoped memory** — each household member's memories are separate

#### Install Mem0 (Self-Hosted — No API Key Needed)

The easiest way is the community OpenClaw plugin that runs in **open-source mode** — it uses your existing AI provider for embeddings, no separate Mem0 account required:

```bash
openclaw plugins install github:tensakulabs/openclaw-mem0
```

Then configure it in `~/.openclaw/openclaw.json`:

```json
{
  "plugins": {
    "entries": {
      "openclaw-mem0": {
        "enabled": true,
        "config": {
          "mode": "open-source"
        }
      }
    }
  }
}
```

Restart OpenClaw:
```bash
openclaw gateway restart
```

That's it. Mem0 will use your already-configured AI provider (the one you set up during `hearth setup`) for embeddings. No extra API keys, no extra containers.

#### Verify Mem0 is Working

```bash
openclaw status
```

Look for `mem0: registered (mode: open-source)` in the output.

Then test in a Hearth chat:
- Say: "Remember that I prefer dark roast coffee"
- Start a new chat
- Ask: "What kind of coffee do I like?"
- The assistant should remember, even in a completely new conversation

#### Mem0 Cloud (Alternative)

If you prefer managed hosting:
1. Sign up at [mem0.ai](https://app.mem0.ai)
2. Get your API key
3. Configure:

```json
{
  "plugins": {
    "entries": {
      "openclaw-mem0": {
        "enabled": true,
        "config": {
          "mode": "cloud",
          "apiKey": "your-mem0-api-key"
        }
      }
    }
  }
}
```

**Note:** Cloud mode sends memory data to Mem0's servers. If privacy is your priority, use open-source mode.

## How Memory Works with Hearth's Household Model

Hearth assigns each user a unique `person identity` (e.g., `person:alex`, `person:sam`). When Mem0 is configured, memories are automatically scoped to each person:

- **Alex's memories** — Alex's preferences, conversations, and context stay with Alex
- **Sam's memories** — Sam's data is separate
- **Household memories** — shared facts (like the home address) can be stored under a shared namespace

This means when Sam asks "What's my favorite color?", the assistant looks up **Sam's** memories — not Alex's.

## Recommended Setup

| Use Case | Best Option |
|----------|------------|
| Just getting started | Built-in (default) — zero setup |
| Want smarter recall | Memory-Core with semantic search (just needs an API key) |
| Serious household use | Mem0 open-source mode — best balance of power and privacy |
| Don't want to self-host memory | Mem0 cloud — easiest but data leaves your server |

## Troubleshooting

**"Memory search returned no results"**
- Check that your AI API key is configured: `openclaw status`
- Try: "Remember that today is Tuesday" → then search: "What day is it?"

**"Mem0 plugin not loading"**
- Check: `openclaw plugins list` — look for `openclaw-mem0`
- Restart: `openclaw gateway restart`
- Check logs: `openclaw gateway logs | grep mem0`

**"Memories from old conversations aren't found"**
- Built-in memory only loads today + yesterday's daily notes
- For older memories, Mem0 or semantic search is needed
- Or manually add important facts to `MEMORY.md`
