# Obsidian Plugin — Design Spec

**Date**: 2026-03-28
**Status**: Draft
**Depends on**: Version History spec (2026-03-28), Shared JS Core extraction

---

## Problem

The writing workflow is Obsidian-native — markdown files in a vault are the source of truth. By the time content reaches Substack or a browser preview, it's already downstream. Running first-misread requires either copy-pasting to a terminal (CLI) or previewing in a browser (extension). Both add friction to the refinement loop. The tool should meet the writing where it lives.

## Solution

An Obsidian plugin that:
1. Runs the first-misread pipeline directly from the active note via a side panel
2. Shows results side-by-side with the draft (same UX as Chrome extension)
3. Persists history to a hidden vault folder for version tracking
4. Shares the JS pipeline core with the Chrome extension (single codebase)

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | Shared JS core + Obsidian UI layer | Pipeline code already exists in the extension. Extract once, consume twice. |
| Results display | Side panel | Side-by-side editing is the natural UX. See feedback while looking at the draft. |
| History persistence | Hidden vault folder (.first-misread/) | Files-over-software. Portable with the vault. Invisible in file explorer. |
| Content identity | Note's vault-relative path | Same file = same piece. Rename = new chain (acceptable tradeoff). |
| Build tool | esbuild | Obsidian community standard. Extension stays on Vite. |

---

## Shared JS Core Extraction

### What moves from `extension/src/core/` to `core/`

All pipeline modules move:
- `pipeline.js`, `analyzer.js`, `selector.js`, `simulator.js`, `aggregator.js`
- `llm-client.js`, `models.js`, `personas.js`

What stays in `extension/`:
- `feedback.js` — browser-specific dismiss/accept state, not relevant to Obsidian

### New modules in `core/`

- `differ.js` — finding matching logic (from version history design)
- `interpreter.js` — revision interpreter Claude call
- `history.js` — read/write run records, resolve parent chains

### Package format

Plain npm package with `package.json`, no build step. Both consumers bundle it at their own build time — Vite for the extension, esbuild for Obsidian.

### Core contract

```javascript
export { runPipeline } from './pipeline.js'
export { diffFindings } from './differ.js'
export { interpretRevision } from './interpreter.js'

runPipeline(text, {
  personas,           // PersonaConfig[]
  onProgress,         // callback (same as current)
  llmClient,          // injected — each surface creates its own
  historyAdapter,     // { loadChain, saveRun, resolveParent }
  includeRewrites,    // boolean
})
```

### History adapter interface

The key abstraction. Each surface implements it differently:

```javascript
interface HistoryAdapter {
  resolveParent(contentId: string): RunRecord | null
  loadChain(contentId: string): RunRecord[]
  loadInput(runId: string): string | null  // input text for diffing
  saveRun(contentId: string, record: RunRecord, inputText: string): void
}
```

- **Extension:** reads/writes `chrome.storage.local`
- **Obsidian:** reads/writes `.first-misread/` vault folder via Obsidian's vault API
- **CLI (Python):** independent implementation in `history.py` (not part of JS core)

### Migration path

The extension's `src/core/` imports change from relative (`./pipeline.js`) to package imports (`@first-misread/core`). Existing extension tests continue to work against the extracted core.

---

## Obsidian Plugin Architecture

### File structure

```
obsidian/
├── manifest.json          # Obsidian plugin manifest
├── main.ts                # Plugin entry (registers commands, views)
├── package.json
├── tsconfig.json
├── src/
│   ├── panel.tsx           # Side panel (Preact)
│   ├── components/
│   │   ├── Analyzer.tsx    # Main view (idle → analyzing → complete)
│   │   ├── FindingCard.tsx
│   │   ├── ResultsSummary.tsx
│   │   └── RevisionNotes.tsx  # Shows diff + interpreter output
│   ├── settings.ts         # Plugin settings tab
│   └── vault-history.ts    # HistoryAdapter for .first-misread/ folder
└── esbuild.config.mjs
```

### Interaction flow

1. Open a note containing your draft
2. Cmd+P → "First Misread: Analyze" (or ribbon icon, or hotkey)
3. Side panel opens, shows persona-by-persona progress
4. If `.first-misread/{note-path}/` has prior runs → differ runs, revision interpreter fires, panel shows "Changes from v1" section + revision notes
5. Results persist to `.first-misread/{note-path}/run-{timestamp}.json`

### Content identity

The note's vault-relative path. Example: `Drafts/chronic-busyness.md` → `.first-misread/Drafts/chronic-busyness/` as the history folder.

Rename the note = new chain. This is an acceptable tradeoff for simplicity — the alternative (tracking by content hash) adds detection machinery we explicitly chose to avoid.

### Settings (Obsidian plugin settings tab)

- LLM provider (Anthropic / OpenAI / Google / OpenAI-compatible)
- API key
- Model
- Results folder name (default `.first-misread`)
- Include rewrites toggle

### Side panel UX

Mirrors the Chrome extension's side panel:
- **Idle state**: "Open a note and click Analyze" + last run info if history exists
- **Analyzing state**: Persona-by-persona progress (streaming via onProgress callback)
- **Complete state**: Changes section (if revision), top findings with FindingCards, persona verdicts, revision notes (if revision)

The panel is an Obsidian `ItemView` registered with a custom view type. It opens in the right sidebar (standard Obsidian plugin pattern).

### History storage

```
.first-misread/
├── Drafts/
│   └── chronic-busyness/
│       ├── run-2026-03-28-200736.json   # RunRecord
│       ├── input-2026-03-28-200736.md   # Input text snapshot
│       ├── run-2026-03-28-210512.json   # v2
│       └── input-2026-03-28-210512.md   # v2 input
└── Posts/
    └── compassion-linkedin/
        ├── run-2026-03-26-101313.json
        ├── input-2026-03-26-101313.md
        └── ...
```

The `.first-misread/` folder is dot-prefixed to be invisible in Obsidian's default file explorer. Each note gets a subfolder mirroring its vault path. Run records and input snapshots are timestamped.

The `vault-history.ts` module implements the `HistoryAdapter` interface using Obsidian's `vault.adapter.read()` / `vault.adapter.write()` API, not direct filesystem access (required for Obsidian plugin compatibility).

---

## Project Structure (after extraction)

```
first-misread/
├── core/                    # Shared JS pipeline (NEW)
│   ├── package.json
│   ├── pipeline.js
│   ├── analyzer.js
│   ├── selector.js
│   ├── simulator.js
│   ├── aggregator.js
│   ├── differ.js           # NEW
│   ├── interpreter.js      # NEW
│   ├── history.js          # NEW
│   ├── llm-client.js
│   ├── personas.js
│   └── models.js
├── extension/               # Chrome extension (refactored)
│   ├── src/
│   │   ├── core/ → imports from core/
│   │   ├── sidepanel/
│   │   ├── background/
│   │   └── content/
│   └── tests/
├── obsidian/                # Obsidian plugin (NEW)
│   ├── manifest.json
│   ├── main.ts
│   └── src/
├── src/first_misread/       # Python CLI (unchanged + history additions)
├── personas/                # YAML definitions (shared)
└── tests/                   # Python tests
```

---

## What This Does NOT Include

- Custom persona creation UI in Obsidian (future feature)
- Obsidian Dataview integration (the hidden folder structure supports it, but no explicit Dataview queries are designed)
- Sync between surfaces (extension history and Obsidian history are independent — same content analyzed in both places produces two separate chains)
- Mobile Obsidian support (plugin API is desktop-only for now)
