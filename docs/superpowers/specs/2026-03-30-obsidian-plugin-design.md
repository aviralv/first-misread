# Obsidian Plugin — Design Spec

**Date**: 2026-03-30
**Status**: Approved
**Supersedes**: 2026-03-28 draft (which assumed shared core extraction)
**Repo**: https://github.com/aviralv/obsidian-first-misread

---

## Problem

The writing workflow is Obsidian-native — markdown files in a vault are the source of truth. Drafts get iterated privately in Obsidian before moving to Substack for external review. Running first-misread requires copy-pasting to a terminal (CLI) or previewing in a browser (extension). Both add friction to the refinement loop where it matters most: the private draft stage.

## Solution

An Obsidian plugin that:
1. Runs the first-misread pipeline directly from the active note via a side panel
2. Shows results side-by-side with the draft
3. Persists history to a hidden vault folder for version tracking
4. Is distributed via BRAT for beta testing

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Repository | Standalone repo (aviralv/obsidian-first-misread) | BRAT requires its own GitHub repo with releases containing main.js + manifest.json |
| Code sharing | Copy extension core modules | Extension is stable/feature-complete. Shared npm package is over-engineered for two consumers where one isn't changing. Reversible — extract later if drift becomes a problem. |
| UI framework | Preact | Same as extension — keeps component logic portable. Lightweight. |
| Build tool | esbuild | Obsidian community standard |
| Results display | Side panel (ItemView) | Side-by-side editing is the natural UX |
| History persistence | Hidden vault folder (.first-misread/) | Files-over-software. Portable with the vault. Invisible in file explorer. |
| Content identity | Note's vault-relative path | Same file = same piece. Rename = new chain (acceptable tradeoff). |
| Version history | Full — differ, interpreter, revision notes | Included in v1. The whole point is iterating on drafts. |

---

## Repo Structure

```
obsidian-first-misread/
├── manifest.json           # Obsidian plugin manifest (BRAT reads this)
├── package.json            # esbuild, preact, vitest
├── tsconfig.json
├── esbuild.config.mjs      # Bundles to main.js + styles.css
├── src/
│   ├── main.ts             # Plugin entry — registers commands, views, settings
│   ├── core/               # Copied from extension + new JS ports
│   │   ├── pipeline.js     # Orchestrator
│   │   ├── analyzer.js     # Content analysis
│   │   ├── selector.js     # LLM-based dynamic persona selection
│   │   ├── simulator.js    # Parallel persona simulation
│   │   ├── aggregator.js   # Finding dedup + merge
│   │   ├── llm-client.js   # Multi-provider client factory
│   │   ├── models.js       # Data factories + validation
│   │   ├── personas.js     # Generated persona definitions
│   │   ├── differ.js       # NEW — JS port of Python differ
│   │   ├── interpreter.js  # NEW — JS port of Python interpreter
│   │   └── history.js      # NEW — vault-based history manager
│   ├── ui/                 # Preact components
│   │   ├── Panel.tsx       # ItemView wrapper — mounts/unmounts Preact
│   │   ├── Analyzer.tsx    # Main state machine (idle → analyzing → complete)
│   │   ├── FindingCard.tsx # Single finding display
│   │   ├── ResultsSummary.tsx # Aggregated view + persona verdict pills
│   │   └── RevisionNotes.tsx  # Diff summary + interpreter output
│   └── settings.ts        # PluginSettingTab
├── styles.css              # Plugin styles (uses Obsidian CSS variables)
└── tests/                  # Vitest tests
```

### BRAT Release Assets

Each GitHub release attaches three files:
- `main.js` — esbuild bundle (single file, all dependencies inlined)
- `manifest.json` — plugin manifest with version, minAppVersion, id
- `styles.css` — plugin styles

---

## Core Pipeline

### Copied from extension (8 modules)

These modules are copied from `first-misread/extension/src/core/` as-is:

| Module | Role |
|--------|------|
| `pipeline.js` | Orchestrator — `runPipeline(client, text, onProgress)` |
| `analyzer.js` | Content analysis — word count, structure, tone |
| `selector.js` | LLM-based dynamic persona selection |
| `simulator.js` | Parallel persona simulation via `Promise.allSettled()` |
| `aggregator.js` | Finding dedup using token-overlap (Dice coefficient, 0.6 threshold) |
| `llm-client.js` | `AnthropicClient`, `OpenAIClient`, `OpenAICompatibleClient`, `createClient()` factory |
| `models.js` | `createFinding()`, `createPersonaResult()`, `createAggregatedFinding()`, `signalStrength()` |
| `personas.js` | Generated at build time from YAML via convert script |

**Note on llm-client.js**: Uses browser `fetch` with `anthropic-dangerous-direct-browser-access` header. Obsidian runs in Electron where `fetch` is available globally. The CORS header is unnecessary but harmless — no change needed.

### New JS ports (3 modules)

Ported from Python (`src/first_misread/`) to complete version history support:

**differ.js** — Finding diff logic
- `passagesMatch(a, b)` — reuse `passagesOverlap()` from `aggregator.js` (Dice coefficient on token sets, 0.6 threshold). This is a different algorithm than Python's `SequenceMatcher` but the same threshold and purpose — good enough for finding matching.
- `diffFindings(currentFindings, chain)` — classifies findings as `new`, `persists`, `resolved`, `regressed`
- Computes `runStreak` (consecutive appearances) and `severityChange` (escalated/de-escalated)

**interpreter.js** — Revision interpreter
- `formatChainSummary(chain)` — formats run history for the prompt
- `buildInterpreterPrompt(diffs, textDiff, chainSummary)` — assembles the prompt
- `interpretRevision(client, diffs, textDiff, chain)` — single LLM call, returns `{ whatLanded, whatPersists, whatRegressed, revisionPattern, suggestion }`
- `parseRevisionNotes(data)` — validates shape, returns null on failure

**history.js** — Vault-based history manager
- Uses Obsidian's `vault.adapter.read()` / `vault.adapter.write()` / `vault.adapter.exists()` — not Node `fs`
- Manages `.first-misread/{note-path}/` folders
- `saveRun(vault, contentId, record, inputText)` — writes `run-{timestamp}.json` + `input-{timestamp}.md`
- `loadChain(vault, contentId)` — loads up to 5 most recent runs
- `resolveParent(vault, contentId)` — returns most recent run record or null
- `loadInput(vault, contentId, runId)` — reads input text snapshot for diffing
- `contentHash(text)` — SHA-256 hex digest (use Web Crypto API available in Electron)

---

## Vault History Storage

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
        └── input-2026-03-26-101313.md
```

- Content identity = vault-relative path of the note
- Note rename = new chain (acceptable tradeoff for simplicity)
- `.first-misread/` is dot-prefixed — invisible in Obsidian's default file explorer
- Max chain length: 5 runs (oldest pruned on save)

---

## UI & Interaction

### Commands

| Command | Action |
|---------|--------|
| `first-misread:analyze` | Runs pipeline on active note, opens panel if closed |
| `first-misread:show-panel` | Opens/focuses the side panel |

Plus a ribbon icon for quick access to analyze.

### Side Panel

Registered as an Obsidian `ItemView` with view type `first-misread-panel`. Opens in the right sidebar.

**State machine** (same as extension):
- **Idle**: "Open a note and click Analyze" + last run info if history exists
- **Analyzing**: Persona-by-persona progress (streaming via `onProgress` callback)
- **Complete**: Findings, persona verdicts, revision notes (if history exists)

### Components

| Component | Role |
|-----------|------|
| `Panel.tsx` | `ItemView` wrapper — creates Preact root on `onOpen`, unmounts on `onClose` |
| `Analyzer.tsx` | Owns all pipeline state. Calls `runPipeline()` directly (no message passing — unlike extension which uses `chrome.runtime.connect()`). Manages idle/analyzing/complete transitions. |
| `FindingCard.tsx` | Single finding: severity badge, persona list, passage quote, description. Expandable. |
| `ResultsSummary.tsx` | Top findings + persona verdict pills. Sorted by severity then persona count. |
| `RevisionNotes.tsx` | Shows when history exists: what landed, what persists, what regressed, revision pattern, suggestion. |

### Styling

Uses Obsidian CSS variables for theme compatibility:
- `--text-normal`, `--text-muted`, `--text-faint`
- `--background-primary`, `--background-secondary`
- `--interactive-accent` for highlights
- `--color-red`, `--color-yellow`, `--color-green` for severity

No hard-coded colors. Plugin matches any Obsidian theme automatically.

---

## Settings

Standard Obsidian `PluginSettingTab`:

| Setting | Type | Default |
|---------|------|---------|
| LLM Provider | Dropdown: Anthropic / OpenAI / Google / OpenAI-compatible | Anthropic |
| API Key | Password field | (empty) |
| Model | Text | claude-sonnet-4-6 |
| Base URL | Text (shown for OpenAI-compatible only) | (empty) |
| Results folder | Text | .first-misread |
| Include rewrites | Toggle | false |

Settings stored via Obsidian's `plugin.loadData()` / `plugin.saveData()`.

---

## What This Does NOT Include

- Custom persona creation UI (future feature)
- Obsidian Dataview integration (folder structure supports it, but no queries designed)
- Sync between surfaces (extension and Obsidian history are independent chains)
- Mobile Obsidian support (desktop-only for now)
- Shared core extraction (deferred — extract if both surfaces actively evolve)
- Feedback accept/dismiss state (extension-specific feature, not relevant for personal draft iteration)
