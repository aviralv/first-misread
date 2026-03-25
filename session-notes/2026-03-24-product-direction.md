# Product Direction & Competitive Analysis — First Misread

**Date**: 2026-03-24 (session 2)
**Type**: strategy + research

---

## What Happened

- Discussed next steps after v1 CLI: quick fixes, custom personas, selector tuning, big swings
- Explored product direction: Chrome extension vs web app
- Decided Chrome extension is the right next step (meets writers where they work)
- Ran competitive analysis of the writing feedback tool market

## Product Direction Discussion

### Quick fixes (do immediately)
- Custom persona creation tool — users need a way to design their own personas beyond hand-editing YAML
- Selector tuning — understand and improve how Claude picks dynamic personas

### Big swing: Chrome extension
- **Why extension over web app first**: meets writers where they work (Substack editor, Medium, Google Docs), eliminates copy-paste friction, same backend API either way
- **User's initial instinct**: web app as step 1, extension as step 2
- **Counter-argument that landed**: extension IS the product — the "paste your text" web app is just a demo. Chrome extension gets real usage data and habit formation.
- **Agreed direction**: Chrome extension first, but do market research before committing

## Competitive Analysis

### The gap: Nobody does persona-based reader simulation

Every tool in the market falls into one of three buckets — none of which is what first-misread does:

| Category | Examples | What they do | What they don't do |
|----------|----------|-------------|-------------------|
| **Grammar/style checkers** | Grammarly, Hemingway Editor, ProWritingAid | Fix errors, improve readability scores, highlight passive voice | Don't simulate how different readers actually process your text |
| **AI writing assistants** | Jasper, ChatGPT, Writesonic | Generate content, adapt tone, Brand Voice matching | Help you write, not test what you wrote |
| **Readability analyzers** | Hemingway, Readable.com, AutoCrit | Score reading level, sentence complexity, word count metrics | Quantitative metrics, not behavioral simulation |

### Closest competitors (and why they're not close)

1. **Jasper Brand Voice** — adapts writing TO an audience, doesn't simulate reading FROM an audience. Writing tool, not a testing tool.
2. **ChatGPT with prompts** ("respond as a skeptical reader") — ad hoc, no structure, no aggregation across personas, no persistent persona definitions. The user has to know what to ask for.
3. **Grammarly** — most installed Chrome extension for writing. Fixes mechanics. Doesn't tell you where your argument breaks down or where a busy reader stops reading.
4. **ProWritingAid** — 20+ reports on style, pacing, repetition. Closest in analytical depth, but still rule-based, not behavioral simulation.
5. **Hemingway Editor** — beloved for simplicity. Readability grade + highlights. No persona concept at all.

### What this means

**First-misread occupies an empty category.** The existing tools answer "Is this well-written?" First-misread answers "Will this be understood?" — a fundamentally different question.

The competitive moat:
- **Behavioral personas** — not just "readability level 8" but "here's what a skeptic does with your unsupported claim"
- **Aggregation** — multiple perspectives surface blind spots a single reader (or single metric) would miss
- **Specificity** — findings point to exact passages, not generic advice

### Market positioning

> "Grammarly tells you it's correct. Hemingway tells you it's readable. First-misread tells you it's understood."

### Chrome extension landscape

- Grammarly: 10M+ users, dominant
- Hemingway: no extension (web app only)
- ProWritingAid: extension exists, modest adoption
- Writer.com: extension for brand consistency
- Wordtune: extension for rephrasing
- None of them simulate reader behavior

## Where else could this be used?

From the discussion:
- **Documentation teams** — test API docs against personas (beginner, experienced dev, manager skimming)
- **Product teams** — test release notes, changelogs, feature announcements
- **Content marketers** — test newsletters before send
- **Education** — test course materials against student personas
- **Internal comms** — test company-wide emails (C-suite skimmer, new hire, remote worker)

---

## Commercialization Research

### Substack Integration
- Possible via unofficial APIs (Python `substack-api` on PyPI, reverse-engineered endpoints)
- Can fetch post content by URL — "paste your Substack URL" flow is viable
- No plugin system — deep editor integration requires Chrome extension anyway

### "Login with Claude"
- Dead end. Anthropic banned OAuth tokens for third-party apps (Feb 2026)
- Must use standard API keys via Claude Console

### BYOK (Bring Your Own Key) Model
- LLM choice doesn't matter much — structured prompts work across frontier models
- BYOK solves the pricing problem: user pays for API calls, product is the personas + aggregation + UX
- Same model as Cursor, Continue.dev, Typingmind — proven to work

### Pricing Tiers (Locked)

| Tier | What we provide | What user provides | Price |
|------|----------------|-------------------|-------|
| **Free** | Personas, pipeline, aggregation, Chrome extension | Their own API key | $0 |
| **Pro** | + Custom personas, saved history, priority | Their own API key | $5-10/mo |
| **Hosted** | Everything including API calls | Nothing | TBD (volume/unit economics needed) |

## Decisions

| Decision | Status | Source |
|----------|--------|--------|
| Chrome extension as next major feature | Decided | This session |
| BYOK as primary model (free tier) | Decided | This session |
| LLM-agnostic — support multiple providers | Decided | This session |
| Hosted tier pricing TBD — needs unit economics | Aligned | This session |
| Custom persona tool needed | Aligned | This session |
| Market gap is real — no direct competitors | Confirmed | Research |

## Architecture Phases

### Step 1: Fully client-side Chrome extension (BYOK)
- Extension runs everything in the browser — calls LLM API directly using user's key
- Persona YAMLs bundled in extension
- Zero backend, zero hosting costs, truly "install and go"
- API keys stored in browser extension storage (standard practice — Cursor, Typingmind do this)
- Supports multiple LLM providers (OpenAI, Anthropic, Google)

### Step 2: Thin backend (Hosted tier)
- Extension sends text to a server, server runs the pipeline
- Adds deployment, hosting, auth, billing
- Only needed for Hosted tier — users who don't want to manage API keys
- Build when there's enough free-tier usage to justify it

## Next Steps

- [ ] Brainstorm Chrome extension UX (sidebar, flow, where it appears)
- [ ] Plan Chrome extension architecture
- [ ] Build Chrome extension (Step 1 — fully client-side, BYOK)
- [ ] Hosted tier + backend (Step 2 — when demand warrants it)
