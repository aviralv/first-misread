---
name: first-misread
description: Run behavioral reading simulation on written content. Synthetic reader personas stress-test blog posts, newsletters, and LinkedIn posts to find misread risks. Use when user says "first-misread", "misread check", "reader test", or wants feedback on a draft before publishing.
---

## What This Skill Does

Runs synthetic reader personas against your writing to find the first place it gets misunderstood.

- Feeds your text through 4 core personas + dynamically selected extras
- Surfaces blind spots: weak hooks, buried ledes, unsupported claims, jargon barriers
- Outputs a ranked summary, per-persona breakdown, and optional rewrite suggestions

**Why this exists**: You can't read your own writing with fresh eyes. This gives you a diverse synthetic audience before you hit publish.

## How to Use

Paste text directly:
```
Run first-misread on this: [paste your text]
```

Or point to a file:
```
Run first-misread on ./drafts/my-post.md
```

Skip rewrites:
```
Run first-misread on ./drafts/my-post.md --no-rewrites
```

## What Happens

1. The skill reads your text and analyzes its structure
2. Claude selects which additional personas are relevant
3. All personas read your text in parallel
4. Findings are deduplicated and ranked
5. (Optional) An editor pass generates rewrite suggestions
6. Results are printed to terminal + saved as markdown files

## Running

```bash
cd /path/to/first-misread
uv run python -m first_misread.cli [file_path] [--text "..."] [--no-rewrites]
```
