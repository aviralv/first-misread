# First Misread

Stress-test your writing with synthetic reader personas. Find the first place your draft gets misunderstood — before a real reader does.

First Misread runs your text through a panel of AI-simulated readers, each with different reading behaviors (skimming, skepticism, emotional response, etc.). It surfaces the exact passage where each persona gets confused, loses interest, or misinterprets your intent.

This is not a writing assistant or grammar checker. It's a diverse synthetic audience that finds your blind spots.

## What it does

- **Analyzes text** against multiple reader personas in parallel
- **Shows where each persona stopped** — the specific passage and why
- **Optionally generates rewrites** for flagged passages
- **Available as**: Python CLI, Chrome extension, and [Obsidian plugin](https://github.com/aviralv/obsidian-first-misread)

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

**Dynamic personas** (selected per-analysis based on content):

Literal Reader, Domain Outsider, Emotional Reader, Scope Cop, Mirror Seeker, Visualizer, Arc Reader, Contrarian, First Principles Thinker, Expansionist, Outsider, Troll.

**Custom personas**: Drop a YAML file in `personas/custom/` to define your own.

## Usage

### Python CLI

```bash
uv run first-misread analyze my-post.md
```

### Chrome Extension

Load the `extension/` folder as an unpacked extension. Click the toolbar icon on any page to analyze.

### Obsidian Plugin

See [obsidian-first-misread](https://github.com/aviralv/obsidian-first-misread) for installation via BRAT.

## Session Notes

See `session-notes/INDEX.md` for detailed progress.

## License

[MIT](LICENSE)
