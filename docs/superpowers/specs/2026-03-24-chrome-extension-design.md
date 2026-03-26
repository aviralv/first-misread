# First Misread — Chrome Extension Design Spec

**Date**: 2026-03-24
**Status**: Draft
**Type**: Chrome Extension (Manifest V3)
**Builds on**: `2026-03-22-first-misread-design.md` (v1 CLI pipeline)

---

## What This Is

A Chrome extension that brings First Misread's behavioral reading simulation directly into the browser. Writers click the extension icon, the side panel opens alongside their editor, and synthetic reader personas analyze their draft in real time — showing where readers will get confused, lose interest, or misunderstand, right next to the text they're editing.

**BYOK (Bring Your Own Key)**: Users provide their own LLM API key. The extension calls the LLM provider directly from the browser. Zero backend, zero hosting costs, zero data leaving the user's control.

**Core value**: Same as v1 — "Here's what you can't see because you wrote it." Now delivered where writers actually work instead of requiring a terminal.

---

## Scope

**In scope (Chrome Extension v1):**
- Chrome Side Panel interface with Preact
- Onboarding wizard (provider selection, API key, test run, privacy messaging)
- LLM-agnostic client supporting Anthropic, OpenAI, Google, and OpenAI-compatible providers
- Content extraction from active tab (platform-specific selectors for Substack, Medium, Google Docs + generic fallback)
- Streaming persona progress (personas complete live, findings appear incrementally)
- Aggregated results view with severity levels and signal strength
- **Feedback interaction: dismiss/accept findings, page-scoped persistence across re-runs**
- Settings management (provider, key, model, preferences)
- All 9 bundled personas (4 core + 5 dynamic)

**Out of scope (v1 stage 1):**
- Custom persona creation (v1 stage 2 — Pro tier)
- Results history / saved analyses (v1 stage 2 — Pro tier)
- Cross-session persona preferences / adaptive persona selection (Tier 2/3 — see Feedback Interaction Model)
- Backend / hosted tier (v2)
- Rewrite suggestions (defer to keep v1 focused on the core feedback loop)
- Chrome Web Store publishing (manual install via developer mode for initial testing)

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────┐
│ Chrome Extension (Manifest V3)                       │
│                                                      │
│  ┌──────────┐    ┌──────────────┐    ┌───────────┐  │
│  │ Content   │───▶│ Service      │◀──▶│ Side      │  │
│  │ Script    │    │ Worker       │    │ Panel     │  │
│  │           │    │ (background) │    │ (Preact)  │  │
│  └──────────┘    └──────┬───────┘    └───────────┘  │
│                         │                            │
│                  ┌──────▼───────┐                    │
│                  │ Core Pipeline │                    │
│                  │ (JS port)    │                    │
│                  └──────┬───────┘                    │
│                         │                            │
│                  ┌──────▼───────┐                    │
│                  │ LLM Client   │                    │
│                  │ (multi-      │                    │
│                  │  provider)   │                    │
│                  └──────┬───────┘                    │
└─────────────────────────┼────────────────────────────┘
                          │ fetch()
                          ▼
              ┌───────────────────────┐
              │ LLM Provider API      │
              │ (Anthropic / OpenAI / │
              │  Google / custom)     │
              └───────────────────────┘
```

### Component Responsibilities

**Content Script (`extractor.js`)**
- Injected into active tab via `activeTab` permission (on-demand, not persistent)
- Extracts text from the current page using platform-specific selectors:
  - Substack editor: `.ProseMirror` or `.post-content`
  - Medium: `.section-content` or `article`
  - Google Docs: DOM traversal of `.kix-lineview` elements
  - Generic fallback: `document.querySelector('article, main, [role="main"]')?.innerText` then `document.body.innerText`
- Returns extracted text + metadata (page URL, detected platform) to service worker

**Service Worker (`service-worker.js`)**
- Extension lifecycle management
- Message routing between content script and side panel
- Orchestrates the analysis pipeline
- Manages `chrome.storage.local` for settings and API keys
- Opens side panel on extension icon click via `chrome.sidePanel.open()`

**Side Panel (Preact app)**
- Primary user interface rendered in Chrome's Side Panel
- Views: Onboarding → Analyzer (main) → Settings
- Components handle display only — all pipeline logic runs in the service worker

**Core Pipeline (JS port)**
- Direct port of the Python pipeline modules to JavaScript
- Same prompts, same persona format, same aggregation logic
- Modules: `analyzer.js`, `selector.js`, `simulator.js`, `aggregator.js`
- Persona definitions bundled as JSON (converted from YAML at build time)

**LLM Client (`llm-client.js`)**
- Single abstraction with provider-specific implementations
- Interface: `async call(system, user, maxTokens) → object | null`
- Implementations:
  - `AnthropicClient` — Anthropic Messages API (`/v1/messages`)
  - `OpenAIClient` — OpenAI Chat Completions API (`/v1/chat/completions`)
  - `OpenAICompatibleClient` — same as OpenAI, custom base URL + optional API key
- Google Gemini's API follows the OpenAI-compatible format, so it's covered by `OpenAICompatibleClient` with Google's base URL
- Provider factory: `createClient(provider, config) → LLMClient`
- JSON response parsing with code fence stripping (carried over from v1 fix)

### Permissions

```json
{
  "permissions": ["sidePanel", "activeTab", "storage"],
  "host_permissions": []
}
```

- `sidePanel` — Chrome Side Panel API
- `activeTab` — read current tab content on user click only (no persistent access)
- `storage` — save API key and settings in `chrome.storage.local`
- No `host_permissions` needed — `fetch()` from the service worker is not subject to CORS restrictions

---

## User Flow

### First Launch (Onboarding Wizard)

**Step 1 — Welcome**
- "First Misread finds where your writing gets misunderstood — before a real reader does."
- Single sentence. No fluff. "Get Started" button.

**Step 2 — Pick your LLM provider**
- Four options with logos:
  - **Anthropic** (Claude)
  - **OpenAI** (GPT-4o)
  - **Google** (Gemini)
  - **Other (OpenAI-compatible)** — expands to show: Base URL, Model name fields
- Each option shows a "Get an API key →" link to the provider's console

**Step 3 — Paste your API key**
- Text field for API key
- If "Other" selected: additional fields for Base URL and Model name
- For Anthropic/OpenAI/Google: optional "Advanced" toggle reveals a custom Base URL field (for proxy servers like LiteLLM, corporate proxies, or caching layers). When set, requests go to the proxy instead of the provider's default endpoint, using the same API format.
- Privacy message prominently displayed:
  > "Your key stays on your device. We never see it, store it, or transmit it to our servers. It goes directly from your browser to your LLM provider."
- Key stored in `chrome.storage.local` (encrypted at rest by Chrome)

**Step 4 — Test run**
- Runs a quick analysis on a built-in sample paragraph (~100 words)
- Validates the API key works
- User sees the streaming persona progress for the first time
- If key is invalid: clear error message with "Try again" option

**Step 5 — Done**
- "You're set. Open any page and click the First Misread icon to start."
- Links to: Settings (change provider later), Documentation

### Main Analysis Flow

1. User is on a writing platform (Substack, Medium, Google Docs, or any page)
2. Clicks the First Misread extension icon → side panel opens
3. Panel shows the **Analyzer view**:
   - "Analyze This Page" button (primary action)
   - Text area for paste input (alternative)
   - Detected platform shown if recognized (e.g., "Substack draft detected")
4. User clicks "Analyze This Page"
5. Content script extracts text from the active tab
6. **Streaming progress begins**:
   - Content metadata shown (word count, read time)
   - "Selecting personas..." → dynamic persona selection completes
   - Each persona listed with status: ○ waiting → ⟳ reading → ✓ complete (with finding count)
   - Findings appear incrementally as personas complete
7. **All personas complete** → view transitions to aggregated results:
   - Findings sorted by severity (high → medium → low) with signal strength
   - Each finding: severity badge, description, flagging personas (expandable)
   - Persona verdict pills at the bottom (✓ pass / ⚠ concerns / ✗ major issues)
8. User can click a finding to expand details (what the persona understood vs. what the author meant)

### Settings

Accessible via gear icon in the side panel header:
- Change LLM provider and API key
- Select model (dropdown populated per provider)
- Toggle: include rewrite suggestions (future, disabled in v1)
- Privacy reminder always visible

---

## Data Flow

### Message Passing

```
Side Panel                    Service Worker               Content Script
    │                              │                            │
    │── connect (port) ──────────▶│                            │
    │── "analyze-page" ──────────▶│                            │
    │                              │── "extract-content" ──────▶│
    │                              │◀── { text, url, platform } │
    │                              │                            │
    │                              │  [run pipeline]            │
    │                              │                            │
    │◀── "progress:metadata" ──── │                            │
    │◀── "progress:personas-selected"│                          │
    │◀── "progress:persona-started"  │                          │
    │◀── "progress:persona-done"     │                          │
    │◀── "progress:persona-done"     │                          │
    │◀── ...                         │                          │
    │◀── "results:complete" ──────── │                          │
    │                              │                            │
    │── disconnect ────────────────│                            │
```

The side panel opens a persistent port to the service worker via `chrome.runtime.connect()`. The service worker posts progress messages to this port as the pipeline runs. This is required because `chrome.runtime.sendMessage` is request/response only — the service worker cannot push unsolicited messages. The port stays open for the duration of the analysis and is disconnected when the side panel closes or a new analysis starts.

### Storage Schema

```javascript
// chrome.storage.local
{
  "provider": "anthropic" | "openai" | "google" | "openai-compatible",
  "apiKey": "sk-...",
  "baseUrl": "https://...",        // custom base URL (required for openai-compatible, optional override for others)
  "model": "claude-sonnet-4-6",   // provider-specific default
  "onboardingComplete": true,
  "preferences": {
    "includeRewrites": false       // future, default off for v1
  }
}
```

---

## Feedback Interaction Model

### Design Principle

The tool's value comes from surfacing blind spots — but not every finding is a blind spot. Some are wrong-genre critiques (Skeptic wanting sources in a personal essay), some conflict with deliberate style choices (Scanner wanting headings in a 240-word post), and some flag real platform constraints the tool doesn't know about. Writers need to triage findings, not just read them.

The interaction model respects the writer's judgment: findings can be dismissed or accepted, and that state persists across re-runs on the same page. This means iterating on a draft doesn't resurface noise you've already filtered.

### Finding States

Each aggregated finding has a `status` field:

```
pending → dismissed | accepted
```

- **`pending`** — default state, finding is visible and unacted-on
- **`dismissed`** — writer has seen it and decided it doesn't apply. Finding collapses to a single muted line (still visible, not deleted — the writer might change their mind)
- **`accepted`** — writer agrees this is a real issue. Finding stays prominent, acts as a revision checklist item

Findings start as `pending`. The writer can toggle between states at any time. There's no "resolved" state — if the writer fixes the issue and re-runs, a dismissed or accepted finding that no longer matches anything in the new results simply disappears.

### UI Changes

**FindingCard** gains two action buttons:
- **Dismiss** (×) — collapses the finding, moves it to a "Dismissed" section at the bottom
- **Accept** (✓) — marks as accepted, keeps it prominent with a subtle highlight

**ResultsSummary** gains a filter toggle:
- Default view: pending + accepted findings (dismissed findings collapsed at the bottom)
- "Show all" toggle: reveals dismissed findings inline at their original severity position

**FindingCard (dismissed state)**:
- Single line: severity dot + truncated description + persona count + "Restore" button
- Muted styling (lower opacity, no expand affordance)
- Grouped under a "Dismissed (N)" collapsible section

**Finding counts** in the header summary reflect only pending + accepted findings, not dismissed ones. This means your "3 high-severity findings" count goes down as you dismiss noise — the number reflects real issues, not raw output.

### Persistence Across Re-runs (Page-Scoped)

When the writer re-runs analysis on the same page, dismissed and accepted findings carry forward — but only if they match a finding in the new results. This is page-scoped: persistence is tied to the tab's URL origin + pathname, and dies when the tab closes or navigates away.

**Matching algorithm**: A dismissed/accepted finding from run N matches a finding in run N+1 if:

1. **Same persona overlap** — at least one flagging persona in common
2. **Similar location** — the quoted text overlaps with a passage in the new results (token overlap ratio > 0.5)
3. **Similar description** — the finding descriptions have high token overlap (ratio > 0.6)

All three conditions must hold. This is intentionally conservative — if you edit the passage substantially and the persona flags it again with a *different* complaint, that's a new finding, not a match for the dismissed one.

**Storage**: Feedback state is held in the service worker's in-memory state, keyed by URL origin + pathname. Not persisted to `chrome.storage` — closing the tab loses it. This is the correct boundary for v1: page-scoped, session-scoped, zero cleanup needed.

```javascript
// In-memory feedback state (service worker)
// feedbackState: Map<string, Map<string, FindingFeedback>>
//   key: url origin + pathname
//   value: Map<findingFingerprint, { status, timestamp }>

// Finding fingerprint: hash of (persona names + quoted text prefix + description prefix)
// Used for matching across re-runs, not exact equality
```

### State Management Update

```javascript
{
  status: "idle" | "extracting" | "analyzing" | "complete" | "error",
  metadata: { wordCount, readTime, ... } | null,
  personas: [
    { name, status: "waiting" | "reading" | "done" | "error", findings: [] }
  ],
  aggregatedFindings: [
    {
      ...existingFields,
      feedbackStatus: "pending" | "dismissed" | "accepted"
    }
  ],
  feedbackCounts: { pending: 0, dismissed: 0, accepted: 0 },
  error: string | null
}
```

### Message Passing Addition

```
Side Panel                    Service Worker
    │                              │
    │── "feedback:update" ────────▶│  { findingFingerprint, status }
    │◀── "feedback:applied" ──────│  { updatedCounts }
    │                              │
    │── "analyze-page" ──────────▶│  (re-run: service worker matches
    │                              │   prior feedback state to new findings)
```

### Future Tiers (Out of Scope for v1)

**Tier 2 — Cross-run persona preferences**: If a writer consistently dismisses Scanner and Skimmer findings, the tool could learn to de-emphasize those personas or exclude them from future runs. Requires persisting feedback patterns to `chrome.storage`.

**Tier 3 — Reasoned dismissals + adaptive selection**: Writers provide a reason when dismissing ("wrong genre," "deliberate style choice," "platform constraint"). The persona selector uses this context to make smarter choices — e.g., don't select the Skeptic for personal essays if the writer has repeatedly dismissed genre-mismatch findings.

These tiers are a natural extension of the v1 data model. The `feedbackStatus` field and fingerprinting approach don't need to change — only where the data is persisted and whether it feeds back into the pipeline.

---

## UI Components (Preact)

### Component Tree

```
App
├── Onboarding (conditional — shown if !onboardingComplete)
│   ├── WelcomeStep
│   ├── ProviderStep
│   ├── ApiKeyStep
│   ├── TestRunStep
│   └── DoneStep
├── Analyzer (main view)
│   ├── Header (logo, settings gear)
│   ├── InputSection
│   │   ├── AnalyzeButton ("Analyze This Page")
│   │   ├── PlatformBadge (detected platform)
│   │   └── TextArea (paste fallback)
│   ├── PersonaProgress (streaming state)
│   │   └── PersonaRow (per persona: status, name, finding count)
│   ├── ResultsSummary (aggregated findings)
│   │   ├── FeedbackFilter (show all / hide dismissed toggle)
│   │   ├── FindingCard (severity, description, personas, dismiss/accept actions)
│   │   ├── DismissedSection (collapsible, muted dismissed findings)
│   │   └── PersonaVerdicts (pill badges)
│   └── FindingDetail (expanded view of single finding)
└── Settings
    ├── ProviderConfig
    ├── ModelSelector
    └── PrivacyInfo
```

### State Management

Preact signals or `useReducer` for analysis state (see also [Feedback Interaction Model](#feedback-interaction-model) for `feedbackStatus` fields):

```javascript
{
  status: "idle" | "extracting" | "analyzing" | "complete" | "error",
  metadata: { wordCount, readTime, ... } | null,
  personas: [
    { name, status: "waiting" | "reading" | "done" | "error", findings: [] }
  ],
  aggregatedFindings: [
    { ...finding, feedbackStatus: "pending" | "dismissed" | "accepted" }
  ],
  feedbackCounts: { pending: 0, dismissed: 0, accepted: 0 },
  error: string | null
}
```

State transitions driven by messages from the service worker. Each `progress:*` message triggers a Preact re-render of the affected component.

---

## Content Extraction

### Platform-Specific Selectors

```javascript
const PLATFORM_SELECTORS = {
  'substack.com': {
    editor: '.ProseMirror',
    published: '.post-content, .body.markup',
    name: 'Substack'
  },
  'medium.com': {
    editor: '.section-content',
    published: 'article',
    name: 'Medium'
  },
  'docs.google.com': {
    editor: '.kix-lineview',  // requires DOM traversal
    name: 'Google Docs'
  }
};

const GENERIC_SELECTORS = [
  'article',
  'main',
  '[role="main"]',
  '.post-content',
  '.entry-content',
  '.article-content'
];
```

**Extraction priority:**
1. Match hostname against `PLATFORM_SELECTORS`
2. Try platform-specific editor selector (for drafts)
3. Try platform-specific published selector (for published posts)
4. Fall back to `GENERIC_SELECTORS` in order
5. Last resort: `document.body.innerText`

**Google Docs special handling:** Google Docs renders text in `.kix-lineview` elements. The extractor traverses these and concatenates their text content. This is a known technique used by Grammarly and other extensions.

---

## LLM Client Abstraction

### Interface

```javascript
class LLMClient {
  async call(system, user, maxTokens = 4096) {
    // Returns parsed JSON object or null on failure
  }
}
```

### Provider Implementations

**AnthropicClient:**
```javascript
// POST https://api.anthropic.com/v1/messages
// Headers: x-api-key, anthropic-version
// Body: { model, max_tokens, system, messages: [{ role: "user", content }] }
// Response: response.content[0].text → JSON.parse
```

**OpenAIClient:**
```javascript
// POST https://api.openai.com/v1/chat/completions
// Headers: Authorization: Bearer <key>
// Body: { model, max_tokens, messages: [{ role: "system", content }, { role: "user", content }] }
// Response: response.choices[0].message.content → JSON.parse
```

**OpenAICompatibleClient:**
```javascript
// Same as OpenAI but with custom baseUrl
// API key optional (for local providers like Ollama, LM Studio)
// Model name required (user-specified)
```

**Factory:**
```javascript
function createClient(provider, config) {
  // All providers support optional baseUrl override (for proxy servers)
  switch (provider) {
    case 'anthropic': return new AnthropicClient(config.apiKey, config.model, config.baseUrl);
    case 'openai': return new OpenAIClient(config.apiKey, config.model, config.baseUrl);
    case 'google': return new OpenAICompatibleClient(
      config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta/openai',
      config.apiKey, config.model
    );
    case 'openai-compatible': return new OpenAICompatibleClient(
      config.baseUrl, config.apiKey, config.model
    );
  }
}
```

All implementations include:
- Code fence stripping (from v1 fix)
- JSON parse error handling with retry
- Timeout handling (30s default)
- Error surfacing to the UI (invalid key, rate limit, model not found)

---

## Pipeline Port (Python → JavaScript)

The core pipeline modules are ported from the Python v1 implementation. The logic, prompts, and data structures remain identical.

### Module Mapping

| Python module | JS module | Changes from Python |
|--------------|-----------|-------------------|
| `analyzer.py` | `analyzer.js` | Pure logic, direct port |
| `personas.py` | N/A | Personas pre-converted to JSON at build time |
| `selector.py` | `selector.js` | Uses `LLMClient` interface instead of `ClaudeClient` |
| `simulator.py` | `simulator.js` | `Promise.allSettled` instead of `asyncio.gather`. Streams progress via callbacks. |
| `aggregator.py` | `aggregator.js` | Direct port. JS doesn't have `SequenceMatcher` — use a simple Levenshtein-based overlap check or port the ratio logic. |
| `rewriter.py` | `rewriter.js` | Deferred in v1 (out of scope) |
| `output.py` | N/A | Not needed — results rendered directly in Preact components |
| `pipeline.py` | `pipeline.js` | Orchestrator emits progress events via callback instead of returning final result |
| `models.py` | `models.js` | Plain objects with JSDoc type annotations. `AggregatedFinding.signal_strength` computed inline (count of personas) rather than via Pydantic `@computed_field`. |

### Key Differences from Python

1. **Progress streaming**: Python pipeline returns a final result. JS pipeline accepts a `onProgress(event)` callback and emits events at each stage.
2. **Parallel execution**: `Promise.allSettled()` replaces `asyncio.gather(return_exceptions=True)`. Same semantics — individual persona failures don't crash the pipeline.
3. **Persona loading**: No YAML parsing at runtime. Personas converted from YAML → JSON at build time and bundled in the extension.
4. **String similarity**: Python's `SequenceMatcher` for finding deduplication needs a JS equivalent. Options: simple token overlap ratio, or a lightweight Levenshtein library.

---

## Build System

**Vite** with the following configuration:
- Preact JSX transform
- Multiple entry points: side panel, service worker, content script
- YAML-to-JSON plugin for persona conversion at build time
- Output to `build/` directory, loadable as unpacked Chrome extension

```
vite.config.js
├── Entry: src/sidepanel/index.html → sidepanel bundle
├── Entry: src/background/service-worker.js → service worker bundle
├── Entry: src/content/extractor.js → content script bundle
└── Plugin: yaml-to-json (personas/*.yaml → personas.json)
```

---

## Testing Strategy

### Unit Tests (Vitest)
- LLM client implementations (mock `fetch`, verify request format per provider)
- Content analyzer (same tests as Python, ported)
- Aggregator (deduplication logic, severity escalation)
- Content extractor (mock DOM structures for each platform)

### Integration Tests
- Full pipeline with mocked LLM responses (same as Python e2e test approach)
- Message passing between service worker and side panel
- Storage operations (save/load settings)

### Manual Testing
- Load as unpacked extension in Chrome
- Test on real Substack, Medium, and Google Docs pages
- Test each LLM provider with real API keys
- Test "Other (OpenAI-compatible)" with Ollama locally

---

## Project Structure

```
first-misread-extension/       (new directory, sibling to existing src/)
├── manifest.json
├── package.json
├── vite.config.js
├── src/
│   ├── background/
│   │   └── service-worker.js
│   ├── content/
│   │   └── extractor.js
│   ├── sidepanel/
│   │   ├── index.html
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── Onboarding.jsx
│   │   │   ├── Analyzer.jsx
│   │   │   ├── PersonaProgress.jsx
│   │   │   ├── FindingCard.jsx
│   │   │   ├── ResultsSummary.jsx
│   │   │   ├── FindingDetail.jsx
│   │   │   └── Settings.jsx
│   │   └── styles/
│   │       └── panel.css
│   ├── core/
│   │   ├── llm-client.js
│   │   ├── analyzer.js
│   │   ├── selector.js
│   │   ├── simulator.js
│   │   ├── aggregator.js
│   │   └── pipeline.js
│   └── shared/
│       ├── storage.js
│       └── models.js
├── personas/                  (symlink or copy from root personas/)
├── tests/
│   ├── llm-client.test.js
│   ├── analyzer.test.js
│   ├── aggregator.test.js
│   ├── extractor.test.js
│   └── pipeline.test.js
└── build/                     (vite output — this IS the unpacked extension)
```

**Why a separate directory**: The Chrome extension is a different runtime (browser JS, not Python). Keeping it in `first-misread-extension/` next to the existing `src/` (Python CLI) avoids tooling conflicts while sharing persona definitions.

---

## Security & Privacy

- **API keys**: Stored in `chrome.storage.local`, which is encrypted at rest by Chrome and accessible only to this extension
- **No network calls to our servers**: All LLM calls go directly from the extension to the user's chosen provider
- **No telemetry**: No analytics, no tracking, no phone-home
- **Content never leaves the browser**: Text extraction and analysis happen locally; only the LLM prompts (containing the user's text) are sent to the LLM provider the user explicitly chose
- **Minimal permissions**: `activeTab` (not broad host permissions), `storage`, `sidePanel`
- **Privacy message**: Shown during onboarding and always accessible in Settings

---

## Success Criteria

- Extension installs and onboarding completes in under 2 minutes
- "Analyze This Page" works on Substack, Medium, and Google Docs without user configuration
- Streaming persona progress feels responsive (first persona result within 5-10 seconds)
- Results are equivalent in quality to the Python CLI output
- Works with all four provider options (Anthropic, OpenAI, Google, OpenAI-compatible)
- Zero backend dependency — works entirely offline from our side
