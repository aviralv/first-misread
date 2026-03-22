# Project Kickoff — First Misread

**Date**: 2026-03-22
**Type**: experiment

---

## What We're Building

A behavioral reading simulation for written content. Synthetic reader personas with configurable traits (knowledge level, skepticism, time pressure, domain familiarity) read your blog posts, newsletters, and LinkedIn posts. They surface the first place your writing gets misunderstood — blind spots you can't see because you wrote it.

Related to edge-case-society (behavioral adversary for AI agents) but kept separate. Both use synthetic personas with behavioral variance, but the detection system and output format are fundamentally different. If both get traction, the persona engine could become a shared platform layer.

---

## Working v1

Input: text (pasted or file path).
Output: structured feedback from multiple reader personas showing:
- What each persona tested (their profile + what they focused on)
- Where they got confused, lost interest, or misunderstood
- Suggested rewrites for problem sections
- Summary file + progressive disclosure files for follow-up

---

## First Milestone

Plan the full system, then build it. Plan-first approach — define persona structure, reading simulation flow, feedback generation, and output format before writing code.

---

## Next Steps

- [ ] Create implementation plan (brainstorm the design, then write an execution plan)
- [ ] Define reader persona structure — adapt edge-case-society's variance axes for content consumption (knowledge level, reading style, skepticism, time pressure, domain familiarity)
- [ ] Design the output format — summary + progressive disclosure for follow-ups

---

**Status**: Kickoff complete — ready to build
