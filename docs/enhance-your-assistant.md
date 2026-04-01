# Enhance Your Assistant

Your Hearth assistant is working — here's how to make it even better.

Each enhancement below is optional and can be added at any time.

---

## 🔍 Web Search

**Without this, your assistant can't look things up online** — no weather, no recipes, no current events.

### Option A: Tavily (recommended)

AI-optimized search results. 1,000 free searches/month.

1. Sign up at [tavily.com](https://tavily.com)
2. Copy your API key
3. Add to `~/.openclaw/openclaw.json`:

```json
{
  "auth": {
    "env": {
      "TAVILY_API_KEY": "your-key-here"
    }
  }
}
```

4. Restart: `openclaw gateway restart`

### Option B: Brave Search

2,000 free searches/month.

1. Get a key at [brave.com/search/api](https://brave.com/search/api/)
2. Add `BRAVE_API_KEY` to `~/.openclaw/openclaw.json` (same format as above)
3. Restart: `openclaw gateway restart`

---

## 🎨 Image Generation

Let your assistant create and edit images.

If you're using **OpenAI** as your model provider, image generation works automatically with the same API key.

For **Google Gemini**, image generation is also supported natively.

If you're using a different provider, add an OpenAI API key for image generation:

```json
{
  "auth": {
    "env": {
      "OPENAI_API_KEY": "your-key-here"
    }
  }
}
```

---

## 🗣️ Text-to-Speech

Let your assistant read messages aloud. Requires an OpenAI API key.

If you already have `OPENAI_API_KEY` configured (for models or image generation), TTS works automatically through Hearth's TTS button in the chat UI.

---

## 🧠 Long-Term Memory

Make your assistant remember things across conversations — preferences, names, routines.

**Built-in memory works by default** (Markdown files). For enhanced semantic memory with Mem0, see the **[Memory Setup Guide](memory-setup.md)**.

---

## 📚 Recommended Skills

Skills give your assistant extra capabilities. Install them with ClawHub:

### Self-Improvement
The assistant learns from its mistakes and your corrections.

```bash
clawhub install self-improving-agent
```

### Weather
Quick weather forecasts and conditions.

```bash
clawhub install weather
```

### More Skills
Browse all available skills:

```bash
clawhub search "your interest"
```

Or visit [clawhub.com](https://clawhub.com) to explore.

---

## 🎭 Personalize Your Assistant

Give your assistant a name and personality that fits your household.

### Display Name

Change the name shown in the Hearth app via the **Dashboard → Agent Settings** page, or set it in `~/.openclaw/hearth.json`:

```json
{
  "agentDisplayName": "Luna"
}
```

### Personality

Your assistant's personality is defined in its OpenClaw workspace. Create or edit `~/.openclaw/workspace/SOUL.md`:

```markdown
# SOUL.md

You are Luna, a warm and helpful household assistant.

## Personality
- Friendly and casual, but not overly chatty
- You know the family well and care about their wellbeing
- You use emoji occasionally but don't overdo it
- You remember preferences and adapt over time

## Boundaries
- Never share one family member's private conversations with another
- Always ask before taking actions that affect the household
- Be honest when you don't know something

## How you address the family
- Dad → "Hey Dad" or by first name
- Mom → "Hey Mom" or by first name
- Kids → by their first name, keep it age-appropriate
```

The agent reads `SOUL.md` at the start of every session. Change it anytime — the personality updates immediately.

### Agent Name in OpenClaw

If you want to rename the agent itself (not just the display name):

```bash
openclaw setup
```

This lets you reconfigure the agent identity, or create a new agent with a different name.

---

## 🔧 Model Configuration

To change your AI model or switch providers:

```bash
openclaw setup
```

This walks you through model selection and authentication (supports OAuth — no API key pasting needed for most providers).

You can also change models per-conversation in the Hearth app using the **Fast/Deep** toggle in the chat header.

---

## 🔄 Keeping Up to Date

```bash
cd ~/hearth
git pull
npx hearth setup  # re-runs setup, skips already-configured steps
```
