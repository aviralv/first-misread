# First Misread — Design Spec

**Date**: 2026-03-22
**Status**: Approved (brainstorming)
**Type**: Experiment / Claude Code Skill

---

## What This Is

A behavioral reading simulation for written content. Synthetic reader personas — each defined by a specific reading behavior — stress-test blog posts, newsletters, and LinkedIn posts. The tool surfaces the first place your writing gets misunderstood, before a real reader does.

Not an AI writing assistant. Not grammar checking. A diverse synthetic audience that finds blind spots you can't see because you wrote it.

**Core value proposition**: "Here's what you can't see because you wrote it" — then you decide what matters.

---

## Scope

**In scope (v1):**
- Short-form content (100-500 words): LinkedIn posts, tweets
- Medium-form content (500-2000 words): blog posts, newsletters
- Claude Code skill invocation (paste text or file path)
- Fixed core personas + dynamically selected personas
- 3-level markdown output (summary, per-persona, rewrites)
- Optional rewrite suggestions (toggleable)

**Out of scope (v1):**
- Long-form content (2000+ words)
- Web app or standalone CLI (future extraction)
- Rich terminal UI widgets (see `docs/future/terminal-rich-ui.md`)
- Custom persona creation UI (users can manually add YAML files)

---

## System Architecture

### Pipeline Overview

```
[1. Input]  →  [2. Content Analysis]  →  [3. Persona Selection]  →  [4. Reading Simulation]  →  [5. Output Generation]
                                                                          ↓ (optional)
                                                                   [4b. Rewrite Pass]
```

### Stage 1 — Input (Python, lives in `pipeline.py`)

- Accept text via: pasted string, file path, or stdin
- Validate: non-empty, within size bounds (50-2500 words — covers short + medium-form with buffer)
- Extract metadata: word count, estimated read time, detect structure (headings, lists, links)

### Stage 2 — Content Analysis (Python)

- Structural analysis: paragraph count, heading hierarchy, sentence length distribution
- Feeds persona selection — no Claude call needed

### Stage 3 — Persona Selection (Claude, single call)

- Always include the fixed core set (4 personas)
- Claude receives the full text + Stage 2 metadata and infers content characteristics (metaphor-heavy, claim-heavy, jargon-dense, etc.) — no separate classification step needed
- Picks 1-3 additional personas from the dynamic catalog based on its assessment
- Returns JSON: `{"dynamic_personas": ["literal-reader", "skeptic"]}` — list of persona filenames (without extension) to load from `personas/dynamic/`

### Stage 4 — Reading Simulation (Claude, parallel calls)

- Each persona gets: the text, their behavior definition (from YAML), and content metadata
- Each returns structured JSON: findings with passage references, severity, what they understood vs. what was meant
- All calls run concurrently via `asyncio.gather`
- Python deduplicates and aggregates findings across personas

### Stage 4b — Rewrite Pass (Claude, single call, optional)

- Receives: original text + all aggregated findings
- Generates: specific rewrite suggestions for flagged passages
- Instructed to preserve author's voice, minimal changes only
- Skipped when user passes `--no-rewrites` flag

### Stage 5 — Output Generation (Python)

- Generates 3 markdown files: L1 summary, L2 per-persona breakdown, L3 rewrites
- Prints L1 to terminal
- Writes all files to timestamped output directory

---

## Persona Design

### Philosophy

Personas are defined by **reading behavior**, not attribute bundles. A "skimmer" is more useful than "medium knowledge, low time" — the behavior is what creates the misread. Attributes explain why.

### Structure (YAML)

Each persona is a YAML file in `personas/core/` (curated) or `personas/custom/` (user-defined).

```yaml
name: The Scanner
type: core                    # core | dynamic | custom
behavior: |
  Spends 30 seconds max deciding if this is worth their time.
  Reads headline, opening line, scans visual structure and length.
  Makes a snap judgment: read or skip.
focus:
  - headline clarity
  - opening hook strength
  - visual density and structure
  - length relative to perceived value
stops_when: |
  Nothing grabs attention in the first 3 sentences,
  or the piece looks too long for the perceived payoff.
output_schema:
  worth_reading: bool
  attention_grabbed_by: string | null
  lost_interest_at: string | null
  time_spent: string
```

**Note on `output_schema`:** This field in persona YAML is guidance/documentation only. All personas return the universal findings JSON schema defined in the Data Flow section. The `output_schema` field helps persona authors think about what their persona should produce, but the runtime schema is standardized.

### Core Personas (always run)

| Persona | Behavior | What It Catches |
|---------|----------|-----------------|
| **The Scanner** | 30-second worth-it decision | Weak hooks, bad structure, unclear value prop |
| **The Skimmer** | Headings, bold text, first sentences only | Ideas that only land if you read every word |
| **The Busy Reader** | Short attention span, drops at first friction | Buried ledes, slow intros, unnecessary preamble |
| **The Challenger** | Reads looking for holes in the argument | Weak claims, missing evidence, logical gaps |

### Dynamic Personas (selected based on content)

| Persona | When Selected | What It Catches |
|---------|--------------|-----------------|
| **The Literal Reader** | Content uses metaphor, irony, sarcasm | Figurative language that misfires |
| **The Visualizer** | Content paints pictures or uses analogies | Metaphors that clash, images that don't work |
| **The Domain Outsider** | Content has jargon or assumed knowledge | Expertise assumptions, unexplained terms |
| **The Skeptic** | Content makes claims or recommendations | Unsupported assertions, missing credibility signals |
| **The Emotional Reader** | Content has personal stories or strong opinions | Tone that alienates, empathy gaps |

### Custom Personas

Users drop a YAML file into `personas/custom/`. Same schema as core/dynamic. Loaded automatically on next run. Custom personas always run (like core).

---

## Data Flow

### Persona Call — Input

```
System: You are simulating a specific reader persona. Read the text below
        exactly as this persona would — follow their behavior, focus on what
        they focus on, stop when they'd stop.

Persona definition: {loaded from YAML}
Content metadata: {word count, structure, read time}
Text: {the actual content}

Return your findings as JSON matching the schema below.
```

### Persona Call — Output (JSON)

```json
{
  "persona": "The Scanner",
  "behavior_executed": "Scanned headline, first 2 sentences, scrolled for length",
  "time_simulated": "12 seconds",
  "overall_verdict": "Would not read further",
  "findings": [
    {
      "type": "confusion | lost_interest | misread | skipped",
      "severity": "high | medium | low",
      "passage": "The exact text that caused the issue",
      "location": "paragraph 2, sentence 1",
      "what_happened": "Headline promises a framework but opening paragraph is a personal anecdote. Scanner sees no connection and bounces.",
      "what_persona_understood": "Author is telling a story",
      "what_author_likely_meant": "Setting context for the framework"
    }
  ]
}
```

### Deduplication (Python)

When multiple personas flag the same passage, merge them. Matching strategy: two findings are considered duplicates if passage text overlap exceeds 60% (via `difflib.SequenceMatcher`). Location field is not used for matching — it's human-readable display text only.

When merged: Merge into a single finding with multiple persona attributions
- Severity = highest among the flagging personas
- Signal strength indicator: "flagged by 3/5 personas"

**Note on `location` field:** The `location` in persona output (`"paragraph 2, sentence 1"`) is human-readable prose, not a structured coordinate. Dedup relies on passage text overlap, not location matching. This is a known limitation — location is for display, not programmatic use.

Passages flagged by multiple personas are the biggest blind spots.

### Rewrite Pass

Aggregated, deduplicated findings + original text go to a single Claude call. This call operates as an editor, not a persona — it sees all the problems and proposes minimal, targeted fixes. Instructed to preserve voice and only change what's needed to resolve the misread.

---

## Output Format

### Directory Structure

```
output/
  YYYY-MM-DD-HHMMSS-{slug}/
    summary.md          # L1 — quick summary
    persona-details.md  # L2 — per-persona breakdown
    rewrites.md         # L3 — rewrite suggestions (if enabled)
```

The `slug` is derived from the input filename (without extension), or first 5 words of the content (lowercased, hyphenated) if pasted. Re-running on the same input creates a new timestamped directory — no overwriting.

### L1 — summary.md (also printed to terminal)

```markdown
# First Misread Report

**Content**: "Why Most Product Roadmaps Are Fiction"
**Word count**: 1,240 | **Est. read time**: 5 min
**Personas run**: 4 core + 2 dynamic (6 total)

## Top Findings

1. **🔴 Opening hook doesn't land** (flagged by 3/6 personas)
   > "In my experience building products across three companies..."
   Scanner bounced here. Busy Reader skipped ahead. Skimmer saw no value signal.

2. **🟡 Claim unsupported in paragraph 4** (flagged by 2/6 personas)
   > "Roadmaps fail 80% of the time"
   Challenger wants a source. Skeptic assumes you made it up.

3. **🟡 Jargon barrier in section 2** (flagged by 1/6 personas)
   > "outcome-driven delivery cadence"
   Domain Outsider lost the thread here.

## Persona Verdicts

| Persona | Verdict | Key Issue |
|---------|---------|-----------|
| Scanner | Would not read | Weak hook |
| Skimmer | Got partial picture | Key point buried in paragraph 5 |
| Busy Reader | Dropped at paragraph 2 | Slow intro |
| Challenger | Read fully | Found 2 weak claims |
| Domain Outsider | Lost at section 2 | Jargon |
| Skeptic | Unconvinced | Missing evidence |
```

### L2 — persona-details.md

Full breakdown per persona: their behavior description, what they did during the simulation, every finding with passage reference and explanation. The "browse at your leisure" file.

### L3 — rewrites.md

Each flagged passage with: the original text, what went wrong (synthesized across personas), and a suggested rewrite. Minimal changes — preserve voice, fix the misread.

---

## Project Structure

```
first-misread/
├── CLAUDE.md
├── README.md
├── pyproject.toml              # uv project, dependencies
├── src/
│   └── first_misread/
│       ├── __init__.py
│       ├── pipeline.py         # Main orchestrator — runs the 5 stages
│       ├── analyzer.py         # Stage 2 — content analysis (Python)
│       ├── selector.py         # Stage 3 — persona selection (Claude call)
│       ├── simulator.py        # Stage 4 — parallel persona simulation (Claude calls)
│       ├── rewriter.py         # Stage 4b — rewrite pass (Claude call)
│       ├── aggregator.py       # Deduplication & ranking (Python)
│       ├── output.py           # Stage 5 — markdown generation (Python)
│       ├── models.py           # Pydantic models for findings, persona output, etc.
│       └── claude_client.py    # Thin wrapper for Claude API calls
├── personas/
│   ├── core/                   # Always-run personas
│   │   ├── scanner.yaml
│   │   ├── skimmer.yaml
│   │   ├── busy-reader.yaml
│   │   └── challenger.yaml
│   ├── dynamic/                # Selected based on content
│   │   ├── literal-reader.yaml
│   │   ├── visualizer.yaml
│   │   ├── domain-outsider.yaml
│   │   ├── skeptic.yaml
│   │   └── emotional-reader.yaml
│   └── custom/                 # User-defined personas
├── skill/
│   └── SKILL.md                # Claude Code skill definition
├── output/                     # Generated reports (gitignored)
├── tests/
├── session-notes/
└── docs/
    ├── superpowers/
    │   └── specs/
    └── future/
        └── terminal-rich-ui.md
```

---

## Tech Stack

- **Python 3.12+** with `uv` for project management
- **anthropic** — Claude API (async client for parallel calls)
- **pyyaml** — persona YAML loading
- **pydantic** — structured data models, JSON schema for Claude's structured output
- **click** — CLI entry point (prep for future standalone extraction)
- **asyncio** — parallel persona simulation via `asyncio.gather`

---

## Invocation

### As Claude Code Skill (v1)

The skill definition in `skill/SKILL.md` tells Claude Code how to invoke the tool. User pastes text or provides a file path. The skill calls the Python pipeline, which handles orchestration and Claude API calls independently.

```
User: Run first-misread on this post: [pastes text]
User: Run first-misread on ./drafts/my-post.md
User: Run first-misread on ./drafts/my-post.md --no-rewrites
```

### Future: Standalone CLI

```bash
first-misread analyze post.md
first-misread analyze post.md --no-rewrites
first-misread analyze --text "paste content here"
```

---

## Configuration

**API key:** `ANTHROPIC_API_KEY` environment variable. Required. The Claude Code skill environment typically has this set already. For standalone CLI extraction, the user must export it.

**Model:** Default to `claude-sonnet-4-6` (Sonnet 4.6) for persona simulation calls (good balance of speed and quality for parallel calls). Rewrite pass and persona selection use the same model. Configurable via `FIRST_MISREAD_MODEL` env var if needed. Update the default as newer models ship.

**Persona directories:** `personas/core/`, `personas/dynamic/`, `personas/custom/` relative to the project root.

---

## Error Handling

**Principle:** Failed persona calls are logged and skipped, not hard failures. The run continues with available results.

- **Malformed persona YAML:** Skip the persona, log a warning with the filename and parse error.
- **Claude API rate limit or timeout:** Retry once with backoff. If still failing, skip the persona and note it in the L1 summary ("1 persona failed, results from 5/6").
- **Malformed persona JSON response:** If Claude returns invalid JSON or missing required fields, skip that persona's findings with a warning.
- **Partial `asyncio.gather` failure:** Use `return_exceptions=True`. Process successful results, log failures.
- **Input file not found:** Hard error, fail immediately with clear message.
- **Input too short/long:** Hard error, fail with word count and valid range.

---

## Testing Strategy

- **Unit tests** for Python stages: `analyzer.py` (structural analysis), `aggregator.py` (dedup logic), `output.py` (markdown generation). These are deterministic and fully testable.
- **Integration tests** use fixture YAML personas and pre-recorded Claude API responses (saved as JSON in `tests/fixtures/`). Generate fixtures by running the pipeline with `FIRST_MISREAD_RECORD=1` to capture raw API responses.
- **Persona YAML validation:** A test that loads all YAML files in `personas/` and validates them against the expected schema.
- **Live smoke test:** A single end-to-end run with a known input text, checking that output files are generated with expected structure. Requires API key, runs manually.

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Behavior-based personas over attribute-based | Behaviors create misreads; attributes explain why | More concrete, actionable findings |
| Parallel persona execution | `asyncio.gather` on all persona calls | 5-7 serial Claude calls would be too slow |
| Separate rewrite pass | Editor sees all findings, not just one persona's | Better quality, avoids personas pretending to be editors |
| YAML persona definitions | Readable, versionable, easy to add | Persona behavior is prompt text, not code logic |
| Python + Claude split | Python for deterministic, Claude for probabilistic | Reproducible pipeline, debuggable, extractable |
| Deduplication by passage | Fuzzy match on location + text | Multi-persona signal is the most valuable output |
| Output as markdown files | Universal, readable, diffable | Fits existing workflow, no special tooling needed |
