# First Misread v0.2.0 — Monorepo Consolidation + Bug Fixes + Features

**Date**: 2026-04-17
**Status**: Draft
**Scope**: Merge obsidian-first-misread into first-misread, consolidate to JS, fix 3 bugs, add 2 features, drop Chrome extension

---

## 1. Overview

Consolidate two repos (`first-misread` + `obsidian-first-misread`) into a single monorepo. Replace the Python CLI with a Node CLI sharing the same JS core as the Obsidian plugin. Fix three bugs. Add one new persona and extend the What's Landing pipeline step.

### Work Items

| # | Item | Type | Surfaces |
|---|---|---|---|
| 1 | Monorepo consolidation (absorb obsidian plugin, delete Python CLI, drop Chrome extension) | Architecture | Both |
| 2 | Native Gemini client (replace OpenAI-compat for Google provider) | Bug fix | Both |
| 3 | Click-to-highlight in Obsidian reading mode | Bug fix | Obsidian |
| 4 | Text selection/copy in finding cards | Bug fix | Obsidian |
| 5 | "The AI Detector" persona | Feature | Both |
| 6 | Reader Takeaways (extend What's Landing) | Feature | Both |

---

## 2. Monorepo Architecture

### Final Directory Structure

```
first-misread/
├── src/
│   ├── core/                  # shared pipeline (single source of truth)
│   │   ├── llm-client.js      # multi-provider (Anthropic, OpenAI, Gemini, OpenAI-compat)
│   │   ├── pipeline.js
│   │   ├── analyzer.js
│   │   ├── simulator.js
│   │   ├── aggregator.js
│   │   ├── selector.js
│   │   ├── strengths.js       # extended with reader takeaways
│   │   ├── differ.js
│   │   ├── interpreter.js
│   │   ├── history.js         # shared history interface
│   │   └── models.js
│   ├── cli/
│   │   ├── cli.js             # Node CLI entry point (commander)
│   │   ├── output.js          # markdown report generation (port of output.py)
│   │   └── history-fs.js      # filesystem-based history
│   └── obsidian/
│       ├── main.ts            # Obsidian plugin entry point
│       ├── settings.ts
│       └── ui/
│           ├── Panel.ts
│           ├── Analyzer.tsx
│           ├── FindingCard.tsx
│           ├── ResultsSummary.tsx
│           ├── PersonaProgress.tsx
│           └── RevisionNotes.tsx
├── personas/
│   ├── core/                  # YAML persona definitions
│   └── dynamic/
├── scripts/
│   └── convert-personas.js    # prebuild: YAML → JS for Obsidian bundle
├── output/                    # CLI output dir (.gitignored)
├── manifest.json              # Obsidian/BRAT manifest (repo root)
├── styles.css                 # Obsidian plugin styles (repo root)
├── package.json               # unified build scripts
├── esbuild.config.mjs         # Obsidian build: src/obsidian/main.ts → main.js
└── tsconfig.json
```

### What Gets Deleted

- `src/first_misread/` — entire Python package
- `extension/` — Chrome extension
- `pyproject.toml`
- Python-specific config and test files

### What Gets Ported (Python → JS)

| Python module | JS destination | Notes |
|---|---|---|
| `cli.py` | `src/cli/cli.js` | Rewrite using `commander`. Args: input file, --text, --provider, --api-key, --model, --no-rewrites, --revision-of, --no-history, --history, --verbose |
| `output.py` | `src/cli/output.js` | Port markdown generation (summary, persona details, rewrites, revision notes). Drop pydantic models — plain objects. |
| `history.py` | `src/cli/history-fs.js` | Port `HistoryManager` using Node `fs`. Same `history.json` + `run.json` + `input.md` structure. |
| `models.py` | Not needed | Pydantic models replaced by plain JS objects. Type safety provided by JSDoc or runtime shape. |
| `personas.py` | Already exists as YAML loader in `scripts/convert-personas.js`. CLI adds a runtime loader that reads YAML directly. |

### Persona Loading Strategy

- **Obsidian build**: `convert-personas.js` runs as prebuild, bakes YAML into `src/core/personas.js` (static module bundled by esbuild). Script path updates to read from `personas/` at repo root and write to `src/core/personas.js`.
- **CLI**: New `loadPersonasFromYaml(dir)` function reads `personas/core/*.yaml` and `personas/dynamic/*.yaml` at runtime using the `yaml` package. Returns the same `{ getCorePersonas(), getDynamicPersonas() }` interface.
- **`src/core/pipeline.js`**: Accepts personas as a parameter rather than importing directly — the caller (CLI or Obsidian Analyzer) provides them.

### BRAT Compatibility

- `manifest.json` stays at repo root
- `main.js` (esbuild output) stays at repo root
- `styles.css` stays at repo root
- GitHub releases attach `manifest.json`, `main.js`, `styles.css` as assets
- BRAT install URL changes: `aviralv/obsidian-first-misread` → `aviralv/first-misread`
- The `obsidian-first-misread` repo gets archived with a README pointing to `first-misread`

### Package Configuration

`package.json` unifies both targets:

```json
{
  "name": "first-misread",
  "version": "0.2.0",
  "type": "module",
  "bin": {
    "first-misread": "src/cli/cli.js"
  },
  "scripts": {
    "prebuild": "node scripts/convert-personas.js",
    "build": "node esbuild.config.mjs production",
    "dev": "node esbuild.config.mjs",
    "test": "vitest run"
  },
  "dependencies": {
    "commander": "^12.0.0",
    "yaml": "^2.7.0"
  },
  "devDependencies": {
    "esbuild": "^0.25.0",
    "obsidian": "latest",
    "preact": "^10.25.0",
    "typescript": "^5.8.0",
    "tslib": "^2.4.0",
    "vitest": "^3.0.0"
  }
}
```

`commander` and `yaml` are runtime deps (CLI needs them). Everything else is dev-only (Obsidian build bundles its deps).

### esbuild Config Change

Entry point changes from `src/main.ts` → `src/obsidian/main.ts`. Output stays `main.js` at repo root. Everything else unchanged.

---

## 3. Native Gemini Client

### Problem

Google's OpenAI-compatible endpoint (`/v1beta/openai/chat/completions`) rejects newer AQ-prefixed Gemini API keys with "Multiple authentication credentials." The native `generateContent` endpoint works fine with the same key.

### Solution

Add `GeminiClient` class to `src/core/llm-client.js`. Route `provider: 'google'` to this client instead of `OpenAICompatibleClient`.

### Client Specifications

```
GeminiClient
  Base URL:    https://generativelanguage.googleapis.com
  Endpoint:    POST {baseUrl}/v1beta/models/{model}:generateContent
  Auth header: x-goog-api-key: {apiKey}
  Default model: gemini-2.5-flash
```

### Request Body

```json
{
  "contents": [
    { "parts": [{ "text": "<user message>" }] }
  ],
  "systemInstruction": {
    "parts": [{ "text": "<system prompt>" }]
  },
  "generationConfig": {
    "maxOutputTokens": 4096
  }
}
```

### Response Parsing

```
response.candidates[0].content.parts[0].text → parseJSON()
```

### Updated Client Registry

| Provider key | Client class | Auth method | Default model |
|---|---|---|---|
| `anthropic` | `AnthropicClient` | `x-api-key` header | `claude-sonnet-4-6` |
| `openai` | `OpenAIClient` | `Authorization: Bearer` | `gpt-4o` |
| `google` | `GeminiClient` (NEW) | `x-goog-api-key` header | `gemini-2.5-flash` |
| `openai-compatible` | `OpenAICompatibleClient` | `Authorization: Bearer` | (user-specified) |

### CLI Provider Flags

```
--provider anthropic|openai|google|openai-compatible
--api-key <key>
--model <model>
```

Env vars: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`. Provider-specific env var takes precedence; `--api-key` flag overrides all.

### Obsidian Settings

Default model for Google provider changes from inherited `claude-sonnet-4-6` to `gemini-2.5-flash`. When user switches provider in the dropdown, model field updates to that provider's default.

---

## 4. Click-to-Highlight in Reading Mode

### Problem

`Analyzer.tsx:147` — `if (editor)` is always truthy on `MarkdownView`, even in reading mode. `highlightInReadingMode()` is never called.

### Fix

Replace the editor existence check with a mode check:

```tsx
const mode = view.getMode();  // 'source' | 'preview'
if (mode === 'source') {
  if (!highlightInEditor(view.editor, passage)) {
    new Notice("Passage not found — the note may have been edited since analysis.");
  }
} else {
  if (!highlightInReadingMode(view.contentEl, passage)) {
    new Notice("Passage not found — the note may have been edited since analysis.");
  }
}
```

`MarkdownView.getMode()` is stable Obsidian API. Returns `'source'` for edit/live-preview, `'preview'` for reading mode.

---

## 5. Text Selection/Copy in Finding Cards

### Problem

`FindingCard` div's `onClick` handler fires on every mouseup, including after text selection drags. Users cannot select text to copy.

### Fix

Add a selection guard at the top of the click handler:

```tsx
onClick={(e) => {
  const selection = window.getSelection();
  if (selection && selection.toString().length > 0) return;
  setExpanded(!expanded);
  onHighlight(finding.passage);
}}
```

If the user has selected text when the click completes, the handler returns early — preserving the selection for copy. Normal clicks (no drag) still expand the card and trigger highlight.

Same guard applies to strength entries in `ResultsSummary.tsx` that have `onClick` handlers.

---

## 6. "The AI Detector" Persona

### Placement

Dynamic persona. Selected when the text has characteristics that might trigger AI suspicion — polished prose, generic examples, list-heavy structure, lack of specific personal detail.

### Definition

File: `personas/dynamic/ai-detector.yaml`

```yaml
name: The AI Detector
type: dynamic
behavior: |
  Reads with one question: "Did a human actually write this?"
  Not looking for proof — looking for the feeling. The uncanny
  smoothness, the too-perfect transitions, the examples that
  could apply to anyone, the absence of rough edges that signal
  a real person thinking in real time. Flags passages that feel
  generated — even if a human wrote them — because that's the
  reader's experience regardless of authorship.
focus:
  - passages that feel smoothed-over or artificially polished
  - generic examples that lack specific, personal detail
  - list structures that feel auto-generated rather than thought-through
  - transitions that are too clean — real thinking has friction
  - absence of voice quirks, hedging, or imperfection that signals humanity
  - "could anyone have written this?" passages vs distinctly authored ones
stops_when: |
  The piece has enough moments of genuine voice — specific details,
  unexpected turns, rough edges — that the "AI wrote this" suspicion
  doesn't survive a full read. A few smooth passages are fine if the
  overall texture feels human.
```

### Design Rationale

Flags passages that *feel* AI-generated, not passages that *are*. The reader's perception is what matters regardless of actual authorship. A human-written passage that reads like ChatGPT output is a real problem for the author.

---

## 7. Reader Takeaways (Extend What's Landing)

### Current State

`strengths.js` → `identifyStrengths(client, text, metadata, results)` makes one LLM call asking for 2-3 "load-bearing passages" — structurally strong moments to protect during revision.

### Extension

Add a second LLM call within the same function that asks: "What 2-3 ideas will a reader carry away from this piece?"

Different question:
- **Strengths** = what the author is doing well (craft)
- **Takeaways** = what the reader will remember (reception)

### Updated Return Shape

```js
{
  strengths: [{ passage, location, why }],          // existing
  takeaways: [{ passage, location, takeaway }]      // new
}
```

Each takeaway: the passage that delivers the idea + what the reader will actually take from it (which may differ from what the author intended).

### Takeaway Prompt Design

- "What will the reader still be thinking about tomorrow?"
- Ask for the reader's *interpretation*, not the author's *intent*
- Exclude passages already flagged as broken (same blocklist as strengths)
- 2-3 entries max

### Takeaway JSON Shape

```json
{
  "passage": "The exact text from the piece",
  "location": "paragraph N",
  "takeaway": "One sentence: what the reader carries away from this"
}
```

### UI Changes (Obsidian)

`ResultsSummary.tsx` currently shows "What's Landing" as one section. Split into two sub-sections:

```
## What's Landing

### Load-Bearing Passages
1. "passage..." (paragraph 3) — why this is load-bearing

### Reader Takeaways
1. "passage..." (paragraph 5) — what the reader takes from this
```

Both remain clickable for highlight-to-passage.

### CLI Output

Same split in `summary.md` under the "What's Landing" heading.

---

## 8. Migration & Cleanup

### obsidian-first-misread Repo

- Archive on GitHub
- Update README to point to `aviralv/first-misread`
- BRAT users will need to update their repo reference (one-time)

### Feature Request Log (Not In Scope)

- Medium/Substack tag suggestions — logged for later iteration

---

## 9. Implementation Order

Suggested sequencing (dependencies noted):

1. **Monorepo setup** — move files, set up new structure, get both builds working
2. **Native Gemini client** — add to `src/core/llm-client.js` (unblocks Google provider users)
3. **Reading mode highlight fix** — surgical change in `Analyzer.tsx`
4. **Text selection fix** — surgical change in `FindingCard.tsx` + `ResultsSummary.tsx`
5. **Node CLI** — port Python CLI to JS, wire up to shared core
6. **AI Detector persona** — add YAML file, run prebuild
7. **Reader Takeaways** — extend `strengths.js`, update UI and CLI output
8. **Cleanup** — delete Python code, Chrome extension, update READMEs
9. **Smoke test** — test both Obsidian plugin and CLI end-to-end
