# First Live Runs — First Misread

**Date**: 2026-03-24
**Type**: testing + iteration

---

## What Happened

- Fixed the plan document (8 issues from previous session's review)
- Executed full 13-task implementation plan via subagent-driven development
- Discovered API proxy returns JSON wrapped in markdown code fences — fixed in ClaudeClient
- Wired ANTHROPIC_BASE_URL from ~/.claude/settings.json into .env
- Ran 3 real end-to-end tests with actual API calls

## Live Test Results

### Test 1: Roadmaps post (synthetic, ~262 words, with rewrites)
- 6 personas ran (4 core + 2 dynamic: Skeptic, Literal Reader)
- Key finding: unsupported "40% faster" stat flagged by 3 personas
- Rewrites produced — 17 suggestions, mostly useful

### Test 2: German citizenship draft (~575 words, with + without rewrites)
- 6 personas ran (4 core + 2 dynamic: Emotional Reader, Domain Outsider)
- Key findings: opening deflates itself (5 personas), IIT unexplained
- Rewrite for opening was good: "It's a bigger deal on paper than it feels — and that gap is worth sitting with."
- `--no-rewrites` confirmed working, faster

### Test 3: AI writing / RLHF post (~1064 words, no rewrites)
- 6 personas ran (4 core + 2 dynamic)
- Key findings: hallucination ≠ inspiration conflation (3 personas), thesis claim unearned (2 personas), detour preamble
- Genuinely useful — the Challenger caught a real logical gap in the central argument

## What Works Well

- Signal finding aggregation — multi-persona flags are the most actionable
- The Challenger is the most useful persona for argumentative writing
- The Emotional Reader adds a dimension that's easy to miss when self-editing
- `--no-rewrites` is noticeably faster and good for a first pass

## Bugs Fixed This Session

- `ClaudeClient`: strip markdown code fences before JSON parsing
- `ClaudeClient`: wire `ANTHROPIC_BASE_URL` env var to proxy support
- 4 new tests added for code fence stripping (53 total, all passing)

---

## Next Steps

- [ ] Try on longer content (approaching 2500 word limit)
- [ ] Test custom persona — create one for a specific target audience
- [ ] Consider: title slug from file stem isn't ideal ("Ai Writing Draft" ← capitalization bug)
- [ ] Consider: `--text` mode for quick pastes without a file
- [ ] Consider: standalone CLI extraction (currently Claude Code skill only)
