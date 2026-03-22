# Brainstorming & Planning — First Misread

**Date**: 2026-03-22
**Type**: design + planning

---

## What Happened

- Created private GitHub repo at `aviralv/first-misread`
- Full brainstorming session through the design of the system
- Wrote and reviewed design spec (2 rounds of automated review, 10+3 issues fixed)
- Wrote implementation plan (13 tasks, TDD throughout)
- Plan review found 8 issues that need fixing before execution

---

## Key Design Decisions

- **Claude Code skill** first, extract to standalone CLI later
- **Short + medium-form** content (up to ~2000 words)
- **Behavior-based personas** (not attribute-based) — what readers *do* creates misreads
- **Fixed core set** (Scanner, Skimmer, Busy Reader, Challenger) + **dynamically selected** extras
- **Parallel execution** via `asyncio.gather` for persona simulation
- **Separate rewrite pass** (toggleable) — editor sees all findings, not just one persona's
- **Python + Claude split** — deterministic in Python, probabilistic via Claude API
- **YAML persona definitions** — curated + custom
- **3-level output**: L1 terminal summary, L2 per-persona breakdown, L3 rewrites

---

## Artifacts

- **Design spec**: `docs/superpowers/specs/2026-03-22-first-misread-design.md`
- **Implementation plan**: `docs/superpowers/plans/2026-03-22-first-misread-design-v1.md`
- **Future reference**: `docs/future/terminal-rich-ui.md` (rich terminal UI via Claude Code extensions)

---

## Plan Review Fixes Needed (Before Execution)

The plan reviewer found these issues. Fix them before starting implementation:

1. **Task 3 — Write all 9 persona YAML files in full**, not "write similar files for..."
2. **Task 1 — Add `asyncio_mode = "auto"`** to `[tool.pytest.ini_options]` in pyproject.toml
3. **Task 11 — Fix pipeline e2e test** — use `return_value` instead of fragile `side_effect` list for mock client
4. **Task 11 — Add boundary tests** for word count validation (49, 50, 2500, 2501 words)
5. **Task 10 — Add `test_write_output_no_rewrites`** — assert `rewrites.md` absent when `rewrites=None`
6. **Task 2 — Use `@computed_field`** from Pydantic v2 instead of `@property` for `signal_strength`
7. **Task 12 — Add CLI test** with `click.testing.CliRunner` and mocked pipeline
8. **Task 13 — Replace `git add -A`** with explicit file list in final commit

---

## Next Steps

- [ ] Fix the 8 plan review issues in the plan document (rewrite with proper markdown formatting)
- [ ] Execute the plan (13 tasks, subagent-driven or inline)
- [ ] Live smoke test with a real blog post draft

---

**Status**: Design complete, plan written, plan review fixes pending
