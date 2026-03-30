# 2026-03-29 — Version History Tracking

**Status**: Complete
**Branch**: `feature/version-history` → merged to main

---

## What Happened

Built the full version history feature: track how content evolves across successive First Misread runs. 8 tasks executed via subagent-driven development across two sessions (context compaction midway).

## Key Outcomes

- **4 new modules**: `history.py`, `differ.py`, `interpreter.py` (new); `output.py`, `pipeline.py`, `cli.py`, `models.py` (extended)
- **4 new Pydantic models**: `RunRecord`, `PersonaVerdict`, `FindingDiff`, `RevisionNotes`
- **HistoryManager**: Tracks version chains via `history.json` index, resolves parents, loads chains (capped at 5)
- **Finding differ**: SequenceMatcher at 0.6 threshold; classifies as PERSISTS/RESOLVED/NEW/REGRESSED with streak counting
- **Revision interpreter**: Single Claude call synthesizing cross-run patterns into editorial advice
- **Pipeline wired**: New Stage 5 (history linking) between aggregation and output
- **CLI flags**: `--revision-of`, `--no-history`, `--history`
- **Output artifacts**: `run.json`, `input.md`, `revision-notes.md`, changes section in `summary.md`
- **98 tests passing** (71 new), 2 pre-existing failures in persona count assertions

## Architecture Decisions

- `run.json` per output directory (not centralized DB) — keeps output self-contained
- `history.json` flat index at output root — lightweight, no external deps
- Fuzzy passage matching (SequenceMatcher 0.6) — handles minor edits between versions
- Chain cap at 5 — prevents unbounded growth in long revision cycles
- Interpreter is optional — gracefully degrades if Claude call fails

## Review Findings Fixed

- Consolidated double `HistoryManager` instantiation in pipeline
- Single `datetime.now()` call in `write_output` for consistent timestamps
- Added diagnostic assertion messages to integration test

## Next Steps

- Design spec for Obsidian plugin already written (`docs/superpowers/specs/2026-03-28-obsidian-plugin-design.md`)
- Obsidian plugin depends on version history (now complete)
- Consider fixing pre-existing persona count test assertions (4→7 core, 5→9 dynamic)
