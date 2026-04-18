# First Misread

**Type**: experiment
**Status**: In Progress
**Started**: 2026-03-22

---

## Project Context

**What this is**: A behavioral reading simulation for written content. Stress-tests blog posts, newsletters, and LinkedIn posts using synthetic reader personas with configurable traits (knowledge level, skepticism, time pressure, domain familiarity). Finds the first place your writing gets misunderstood — before a real reader does. NOT an AI writing assistant or grammar checker. A diverse synthetic audience that surfaces blind spots.

**Working v1**: Feed it text (pasted or file) and get back structured feedback from multiple reader personas. Output includes: what each persona tested, where they got confused or lost interest, load-bearing passages, reader takeaways, and optional rewrites. Available as Node CLI and Obsidian plugin (single JS monorepo, shared core).

**Architecture**: Monorepo with `src/core/` (shared pipeline), `src/cli/` (Node CLI), `src/obsidian/` (Obsidian plugin). Personas in `personas/` as YAML. Multi-provider LLM support (Anthropic, OpenAI, Google Gemini, OpenAI-compatible).

---

## Session Continuity

Session notes live in the Product Kitchen repo (private), not here.
Location: `the-product-kitchen/session-notes/first-misread-*.md`

---

## Working Style

- Direct and conversational. No corporate tone.
- Bias toward action. Reversible decisions: decide fast, iterate.
- No over-explaining. If I have context, skip the recap.
- 3-5 bullets max. Cut to the essence.
- When stuck: build a small thing to learn, don't research endlessly.

---

## Product Kitchen Plugin

Full working style, personality context, and shared skills will be available
via the Product Kitchen marketplace plugin when it ships.


## Verification Discipline

- Before stating something as fact, ask: *did I verify this, or does it just feel right?*
- **Cite or retract.** Every factual claim must trace to a tool call, file read, or direct user statement from this conversation. If a lookup returns "not found", either look it up via another source or say "I don't have verified info." Never bridge the gap with memory or inference and present it as fact.
- **People's roles, teams, titles**: Always use org-lookup or Slack profile lookup. Never fill gaps from memory.
- **File paths and function names**: Glob/Grep/Read before referencing.
- **"This should work" / "That will fix it"**: Run it or caveat it.
- **The cost of checking is seconds. The cost of being wrong is trust.**
