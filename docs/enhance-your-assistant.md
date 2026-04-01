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
