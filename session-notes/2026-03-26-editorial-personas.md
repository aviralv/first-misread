# 2026-03-26 — Editorial Personas for Blog-Length Content

## Context

After iterating heavily on a LinkedIn post (memory vs configuration in AI tools), the editing process revealed persona gaps — feedback patterns that no existing persona was designed to catch. Separately, tested the full persona set against 4 published blog pieces to identify what longer-form personal essays need that short-form LinkedIn posts don't.

## What Happened

### New Core Personas (3)
Created from patterns observed during LinkedIn post editing:

- **Hook Judge** — reads only the first 2-3 lines, judges whether the opening earns a scroll-stop. Created because the LinkedIn drafting process went through ~5 hook iterations before landing.
- **Voice Editor** — listens for register consistency across the full piece. Catches tone shifts (reflective → preachy, personal → addressing-an-audience), vague abstractions, and scope mismatch. Updated in this session to also detect **section seams** — register shifts at boundaries that reveal a piece was assembled from separate writing sessions.
- **Sensitivity Scanner** — reads assuming employer, customers, competitors, and strangers will see it. Flags internal context leaks. Created after early LinkedIn drafts accidentally included internal project names and customer references.

### New Dynamic Personas (4)
Created for personal essay / blog-length content (up to 1500 words):

- **Mirror Seeker** — reads for the "I → we" moment where personal experience connects to shared recognition. Flags self-indulgence and premature universalizing.
- **Arc Reader** — reads for narrative momentum across sections. Updated in this session to include **earned close** checks — endings that reach beyond what the essay built, tipping from insight into aphorism.
- **Cringe Detector** — flags performative vulnerability, false modesty, platitudes, and LinkedIn-brain leak in personal essays.
- **Scope Cop** — counts thesis-level claims vs word count. Flags analytical pieces trying to land too many ideas. Especially tuned for the pattern of adding layers because each feels too interesting to cut.

### Live Test
Ran the updated persona set against a draft origin-story piece ("building with AI" series). Key findings:
- Scope Cop immediately flagged the piece was trying to do 3 things (origin story + changed PM ear + two paths framework) — recommended splitting
- Voice Editor caught a register break in section 4 (reflective → product copy)
- Cringe Detector flagged "eight times out of ten I can build the thing" as humble brag
- Arc Reader flagged the ending as a bookmark, not a landing

## Persona Roster (now 16 total)

**Core (7):** Scanner, Skimmer, Busy Reader, Challenger, Hook Judge, Voice Editor, Sensitivity Scanner

**Dynamic (9):** Literal Reader, Visualizer, Domain Outsider, Skeptic, Emotional Reader, Mirror Seeker, Arc Reader, Cringe Detector, Scope Cop

### Extension Bundle Sync
Rebuilt `extension/src/core/personas.js` to match all 16 YAML personas:
- Voice Editor: added seam detection focus items
- Arc Reader: added earned-close focus items
- Scope Cop: added to dynamic array
- 58 tests passing, all green

## Next Steps
- Run the compassion piece (published) through updated set as validation
- Consider whether Scope Cop should also check LinkedIn posts (they have a tighter word budget)
