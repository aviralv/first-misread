# Version History — Design Spec

**Date**: 2026-03-28
**Status**: Draft
**Depends on**: Existing pipeline (v1, built 2026-03-23)

---

## Problem

Every first-misread run is stateless. When you revise a piece and run the tool again, it re-discovers the same issues with no awareness of what you've already seen, what you fixed, or what got worse. You're manually tracking versions by appending "-v2", "-v3" to output folder names. The refinement loop has no memory.

## Solution

Add a history layer to the pipeline that:
1. Persists structured run data alongside the existing markdown output
2. Links runs into version chains (by URL, file path, or explicit flag)
3. Diffs findings across runs (RESOLVED / PERSISTS / NEW / REGRESSED)
4. Runs a revision interpreter that synthesizes across the full chain history

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Storage | JSON files (run.json + history.json) | Files-over-software. Inspectable with cat. Migrates to SQLite later if needed. |
| Persona context | Post-hoc comparison | Fresh eyes is the core mechanic. Anchoring personas to prior findings undermines it. |
| Linking (browser/Obsidian) | URL/path identity | Same URL = same piece. No detection machinery needed. |
| Linking (CLI) | Explicit `--revision-of` flag | Terminal users know what they're doing. A flag is natural. |
| Interpreter scope | Full chain history (capped at 5 runs) | Multi-run patterns ("Scanner flagged this 3 times") require chain visibility. |
| Interpreter | Always runs when parent exists | The revision notes are the primary value of the feature. |

---

## Data Model

### RunRecord (new Pydantic model)

Written as `run.json` in each output directory.

```python
class RunRecord(BaseModel):
    run_id: str              # directory name (2026-03-26-101313-compassion-linkedin)
    timestamp: str           # ISO 8601
    slug: str                # e.g. "compassion-linkedin"
    content_hash: str        # SHA-256 of the input text
    word_count: int
    model: str               # which Claude model was used
    personas_run: list[str]  # names of all personas that ran
    parent_run_id: str | None  # link to previous version
    metadata: ContentMetadata
    findings: list[AggregatedFinding]
    persona_verdicts: list[PersonaVerdict]
```

### PersonaVerdict (new Pydantic model)

```python
class PersonaVerdict(BaseModel):
    persona: str
    verdict: str
    key_issue: str
```

### FindingDiff (new Pydantic model)

Produced by the differ for each finding in a revision run.

```python
class FindingDiff(BaseModel):
    status: Literal["resolved", "persists", "new", "regressed"]
    current_finding: AggregatedFinding | None  # None if resolved
    parent_finding: AggregatedFinding | None   # None if new
    severity_change: str | None  # "escalated", "de-escalated", None
    persona_count_change: int | None  # e.g. +2, -1
    run_streak: int  # consecutive runs flagged (0 if new)
```

### RevisionNotes (new Pydantic model)

Produced by the revision interpreter Claude call.

```python
class RevisionNotes(BaseModel):
    what_landed: list[str]
    what_persists: list[str]
    what_regressed: list[str]
    revision_pattern: str     # meta-observation about revision behavior
    suggestion: str           # one concrete next-move recommendation
```

### history.json (index file)

Lives at `output/history.json`. Maps chains and provides lightweight run lookup.

```json
{
  "chains": {
    "compassion-linkedin": [
      "2026-03-26-101313-compassion-linkedin",
      "2026-03-26-104055-compassion-linkedin-v2",
      "2026-03-26-110911-compassion-linkedin-v3"
    ]
  },
  "runs": {
    "2026-03-26-101313-compassion-linkedin": {
      "timestamp": "2026-03-26T10:13:13",
      "slug": "compassion-linkedin",
      "content_hash": "a1b2c3...",
      "parent_run_id": null
    }
  }
}
```

The `chains` dict groups runs by content lineage. The `runs` dict is a lightweight lookup — full data lives in each run's `run.json`.

**Chain keys are surface-dependent:**
- **CLI:** keyed by slug (e.g., `compassion-linkedin`). The `--revision-of` flag references the slug or run ID.
- **Chrome extension:** keyed by URL origin+pathname (e.g., `aviralv.substack.com/p/chronic-busyness`). Auto-detected from the active tab.
- **Obsidian plugin:** keyed by vault-relative note path (e.g., `Drafts/chronic-busyness.md`). Auto-detected from the active note.

Each surface writes to its own history store (CLI: `output/history.json`, extension: `chrome.storage.local`, Obsidian: `.first-misread/` vault folder). Chains do not sync across surfaces.

---

## Finding Matching (Differ)

Compares current run's `list[AggregatedFinding]` against parent run's findings.

**Algorithm:** `SequenceMatcher.ratio()` on the `passage` field. Threshold: 0.6 (same as existing aggregator dedup).

**Classification:**
- **PERSISTS** — current finding matches a parent finding. Includes severity change direction and persona count change.
- **RESOLVED** — parent finding has no match in current findings.
- **NEW** — current finding has no match in parent findings.
- **REGRESSED** — a finding that was RESOLVED in a previous run but reappears (matched against any ancestor in the chain, not just immediate parent).

**Run streak:** Calculated by walking the chain. If "no headings" has been flagged in 3 consecutive runs, `run_streak: 3`.

---

## Revision Interpreter

One additional Claude call. Only fires when a parent run exists.

**Input:**
- `list[FindingDiff]` from the differ
- Full chain of prior `RunRecord`s (capped at 5 most recent; older runs summarized in one line)
- Unified text diff between current input and immediate parent's `input.md`

**System prompt:** "You are an editorial advisor reviewing successive drafts of the same piece. You have the full history of reader-simulation feedback across all versions. Your job is to tell the author what their revision pattern reveals — not to repeat what the personas already said, but to synthesize across runs."

**Output:** `RevisionNotes` model, rendered as `revision-notes.md`.

**Token budget:** Chain history capped at 5 most recent runs. Earlier runs condensed to a one-line summary of persistent findings.

---

## Pipeline Changes

### Revised flow

```
Input text
  ├─ Stage 1: Validate input (unchanged)
  ├─ Stage 2: Analyze content (unchanged)
  ├─ Stage 3: Select personas (unchanged)
  ├─ Stage 4: Simulate personas (unchanged)
  ├─ Stage 4b: Rewrites (unchanged)
  ├─ Stage 4c: Aggregate (unchanged)
  ├─ Stage 5: History linking (NEW)
  │   ├─ Hash input, resolve parent (URL/flag/none)
  │   ├─ If parent exists: load chain, run differ
  │   └─ If diffs exist: run revision interpreter
  └─ Stage 6: Output (extended)
      ├─ summary.md (now with "Changes" section if parent exists)
      ├─ persona-details.md (unchanged)
      ├─ rewrites.md (unchanged)
      ├─ revision-notes.md (NEW, only if parent exists)
      ├─ input.md (NEW, copy of input text for future diffing)
      └─ run.json (NEW, structured RunRecord)
```

### New CLI options

- `--revision-of <slug-or-run-id>` — explicit parent linking
- `--no-history` — skip history entirely (run exactly like today)
- `--history <slug>` — show chain history for a slug without running analysis. Prints: chain length, run timestamps, top persistent findings, severity trends.

### New modules

- `src/first_misread/history.py` — manages history.json, resolves parents, loads chains
- `src/first_misread/differ.py` — finding matching, produces list[FindingDiff]
- `src/first_misread/interpreter.py` — revision interpreter Claude call

### Changes to existing modules

- `models.py` — add RunRecord, PersonaVerdict, FindingDiff, RevisionNotes
- `output.py` — write run.json, input.md, revision-notes.md; prepend changes section to summary.md
- `pipeline.py` — add Stage 5 between aggregation and output
- `cli.py` — add --revision-of, --no-history, --history flags

### Unchanged modules

analyzer.py, selector.py, simulator.py, aggregator.py, rewriter.py, claude_client.py, all persona YAMLs.

---

## Output Format

### Changes section (prepended to summary.md when parent exists)

```markdown
## Changes from previous run (v2 → v3)
- ✅ RESOLVED: "I to you" pivot (was #1, flagged by 4 personas)
- 🔴 NEW: CTA line flagged by 3 personas
- ⚠️ PERSISTS (3 runs): Opening redefinition (3→5 personas, escalated)
- ⚠️ PERSISTS (3 runs): No headings (Scanner, Skimmer)
```

### revision-notes.md

```markdown
# Revision Notes

## What Landed
- [list of fixes that worked and why]

## What Persists
- [issues that remain, with pattern diagnosis]

## What Regressed
- [things that got worse]

## Revision Pattern
[meta-observation about how the author revises]

## Suggestion
[one concrete next-move recommendation]
```

### Terminal output on detection

```
Linked: revision of compassion-linkedin (v2 → v3)
Content diff: 6 lines changed, 3 added, 2 removed
Chain: v1 → v2 → this run (v3)
```
