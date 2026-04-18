# First Misread

Stress-test your writing with synthetic reader personas. Find the first place your draft gets misunderstood — before a real reader does.

First Misread runs your text through a panel of AI-simulated readers, each with different reading behaviors (skimming, skepticism, emotional response, etc.). It surfaces the exact passage where each persona gets confused, loses interest, or misinterprets your intent.

This is not a writing assistant or grammar checker. It's a diverse synthetic audience that finds your blind spots.

## Quick Start

```bash
# Set your API key
export ANTHROPIC_API_KEY="sk-ant-..."

# Run on a file (zero install)
npx first-misread my-post.md

# Or install globally
npm install -g first-misread
first-misread my-post.md
```

That's it. You'll get a structured report showing where each persona stopped reading, what landed, and what didn't.

## Providers

First Misread works with multiple LLM providers. Set the API key as an environment variable and it's picked up automatically.

| Provider | Flag | Env Variable | Default Model |
|----------|------|-------------|--------------|
| Anthropic | `--provider anthropic` (default) | `ANTHROPIC_API_KEY` | claude-sonnet-4-6 |
| OpenAI | `--provider openai` | `OPENAI_API_KEY` | gpt-4o |
| Google Gemini | `--provider google` | `GEMINI_API_KEY` | gemini-2.5-flash |
| OpenAI-compatible | `--provider openai-compatible` | — | — |

```bash
# Anthropic (default)
first-misread my-post.md

# OpenAI
first-misread my-post.md --provider openai

# Google Gemini
first-misread my-post.md --provider google

# Any OpenAI-compatible endpoint (e.g. Ollama, Together, Groq)
first-misread my-post.md --provider openai-compatible \
  --base-url http://localhost:11434/v1 \
  --model llama3 \
  --api-key "not-needed"
```

## Input Methods

```bash
# File path
first-misread draft.md

# Paste text directly
first-misread --text "Your blog post text here..."

# Pipe from stdin
cat draft.md | first-misread
pbpaste | first-misread
```

## What You Get

Each run produces a structured report in the `output/` directory:

- **Per-persona findings** — where each reader stopped, why, and which passage triggered it
- **What's Landing** — load-bearing passages (what's working) and reader takeaways (what readers will actually remember)
- **Suggestions** — optional alternative phrasings for flagged passages

The summary is also printed to stdout so you can pipe it or just read it in the terminal.

## Personas

Personas define *how* a simulated reader approaches your text. Each has a reading behavior, focus areas, and conditions that make them stop.

**Core personas** (always run):

| Persona | What they test |
|---------|---------------|
| The Skimmer | Does the piece survive non-linear, partial reading? |
| The Busy Reader | Does the opening earn enough interest to keep reading? |
| The Hook Judge | Does the first line work? |
| The Skeptic | Are claims supported — logically and with credibility? |
| The Sensitivity Scanner | Anything that could land badly out of context? |
| The Voice Editor | Is the voice consistent, authentic, and cringe-free? |
| The Executor | Can the reader actually do something with this? |
| The Structural Reader | Does the structure serve the content? |

**Dynamic personas** (selected per-analysis based on content):

Literal Reader, Domain Outsider, Emotional Reader, Scope Cop, Mirror Seeker, Visualizer, Arc Reader, Contrarian, First Principles Thinker, Expansionist, Outsider, Troll, The AI Detector.

### Custom Personas

Drop a YAML file in `personas/dynamic/` to define your own:

```yaml
name: The Hiring Manager
type: dynamic
behavior: |
  Reads with 30 seconds of attention. Scans for red flags,
  jargon that doesn't match the role, and anything that feels
  copy-pasted. Looking for signal that this person actually
  thought about the specific role.
focus:
  - generic language that could apply to any company
  - claims without concrete evidence
  - mismatch between stated experience and tone
stops_when: |
  The writing feels specific, genuine, and shows clear
  understanding of what the role actually requires.
```

## CLI Reference

```
Usage: first-misread [input] [options]

Arguments:
  input                      Path to a text file to analyze

Options:
  -t, --text <text>          Paste text directly instead of a file path
  -p, --provider <provider>  LLM provider (default: "anthropic")
  -k, --api-key <key>        API key (overrides env var)
  -m, --model <model>        Model name (overrides provider default)
  --base-url <url>           Override API base URL
  --no-suggestions           Skip suggested alternatives for flagged passages
  --revision-of <ref>        Link to a previous run by slug or run ID
  --no-history               Skip history tracking
  --history <slug>           Show chain history for a slug
  -v, --verbose              Enable debug logging
  -V, --version              Output the version number
  -h, --help                 Display help
```

## Obsidian Plugin

First Misread is also available as an [Obsidian](https://obsidian.md) plugin. Analyze your notes directly from the editor.

Install via [BRAT](https://github.com/TfTHacker/obsidian42-brat):

1. Install the BRAT plugin in Obsidian
2. In BRAT settings, click "Add Beta plugin"
3. Enter `aviralv/first-misread`
4. Enable the plugin in Obsidian settings

## Troubleshooting

**"Error: No API key"**

Set the environment variable for your provider. The CLI checks these in order:
1. `--api-key` flag
2. Environment variable (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `GEMINI_API_KEY`)

```bash
# Add to your shell profile (~/.zshrc, ~/.bashrc)
export ANTHROPIC_API_KEY="sk-ant-..."
```

**"fetch failed" or network errors with Google Gemini**

The Gemini API requires the Generative Language API to be enabled in your Google Cloud project. Get a key at [aistudio.google.com](https://aistudio.google.com/apikey).

**Node version errors**

First Misread requires Node.js 18 or later. Check with `node --version`.

**Stdin hangs (no output)**

When piping, the CLI waits for EOF. Make sure your pipe actually closes:
```bash
# This works
echo "text" | first-misread

# This hangs (stdin stays open)
first-misread
# Ctrl+D to send EOF, or Ctrl+C to cancel
```

**Rate limits**

If you hit rate limits, the error message from your provider will be passed through. Wait and retry, or switch to a different provider.

## License

[MIT](LICENSE)
