# Session: 2026-04-13 — Persona Overhaul

## What happened

Added 6 new personas and restructured the entire persona roster through overlap analysis and merges.

### New personas added (all dynamic)
- **Contrarian** — constructs strongest counter-case to author's argument
- **First Principles Thinker** — strips arguments to foundational assumptions
- **Expansionist** — grows ideas beyond author's scope, finds unexplored implications
- **Executor** — "what do I actually do with this?" (later promoted to core)
- **Outsider** — different worldview, not just vocabulary
- **Troll** — bad-faith decontextualization stress test

### Overlap analysis & merges
Ran systematic overlap analysis across all 22 personas. Found 3 pairs with same-passage/same-reason overlap:

1. **Scanner + Skimmer → The Skimmer** (core) — Scanner was a near-subset of Skimmer; merged snap-judgment behavior into the deeper skim
2. **Challenger + Skeptic → The Skeptic** (core) — heavy overlap on unsupported claims; merged internal logic testing + external credibility into one
3. **Voice Editor + Cringe Detector → The Voice Editor** (core) — only true same-reason overlap in the set (essay-to-thought-leadership voice shift); merged consistency + authenticity checks

### Promotion
- **Executor** moved from dynamic → core. The "so what?" test is universal.

### Final roster
- **7 core**: Skimmer, Busy Reader, Hook Judge, Skeptic, Sensitivity Scanner, Voice Editor, Executor
- **12 dynamic**: Arc Reader, Contrarian, Domain Outsider, Emotional Reader, Expansionist, First Principles Thinker, Literal Reader, Mirror Seeker, Outsider, Scope Cop, Troll, Visualizer
- **19 total** (was 16, added 6, merged 3)

### Both repos updated
- `first-misread`: YAML files, test assertions, generated extension `personas.js`
- `obsidian-first-misread`: YAML files, generated `personas.js`, `main.js` rebuilt, version bumped to 0.1.4, tagged for release

## Next
- Push both repos (obsidian tag triggers CI release)
- Manual smoke test in Chrome with updated personas
- Selector tuning — with 12 dynamic personas, selection quality becomes more important
