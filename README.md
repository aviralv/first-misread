# First Misread

Stress-test your writing with synthetic reader personas. Find the first place your draft gets misunderstood — before a real reader does.

First Misread runs your text through a panel of AI-simulated readers, each with different reading behaviors (skimming, skepticism, emotional response, etc.). It surfaces the exact passage where each persona gets confused, loses interest, or misinterprets your intent.

This is not a writing assistant or grammar checker. It's a diverse synthetic audience that finds your blind spots.

## What it does

- **Analyzes text** against multiple reader personas in parallel
- **Shows where each persona stopped** — the specific passage and why
- **What's Landing** — identifies load-bearing passages and reader takeaways
- **Optionally generates rewrites** for flagged passages
- **Available as**: Node CLI and [Obsidian plugin](https://github.com/aviralv/first-misread) (install via BRAT)

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

**Custom personas**: Drop a YAML file in `personas/dynamic/` to define your own.

## Usage

### Node CLI

```bash
node src/cli/cli.js my-post.md --provider anthropic --api-key "$ANTHROPIC_API_KEY"
```

Supports providers: `anthropic`, `openai`, `google`, `openai-compatible`.

### Obsidian Plugin

Install via [BRAT](https://github.com/TfTHacker/obsidian42-brat) with repo `aviralv/first-misread`.

## Architecture

Single monorepo with shared JS core:

```
src/core/       # Shared pipeline (LLM clients, analysis, simulation, aggregation)
src/cli/        # Node CLI entry point
src/obsidian/   # Obsidian plugin (Preact UI, settings, vault integration)
personas/       # YAML persona definitions (core + dynamic)
```

## Session Notes

See `session-notes/INDEX.md` for detailed progress.

## License

[MIT](LICENSE)
