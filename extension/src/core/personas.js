// Auto-generated from personas/*.yaml — do not edit manually.
// Run: node scripts/convert-personas.js

const CORE_PERSONAS = [
  {
    "name": "The Busy Reader",
    "type": "core",
    "behavior": "Has 2 minutes between meetings. Starts reading with good intentions\nbut drops at the first sign of friction — slow intros, unnecessary\npreamble, or paragraphs that don't earn their length.\n",
    "focus": [
      "speed to first insight",
      "paragraph economy",
      "buried ledes",
      "unnecessary preamble or throat-clearing"
    ],
    "stops_when": "The first two paragraphs don't deliver value,\nor the piece feels like it's warming up instead of delivering.\n"
  },
  {
    "name": "The Challenger",
    "type": "core",
    "behavior": "Reads the full piece looking for holes in the argument.\nTests every claim against \"says who?\" and \"based on what?\"\nWants evidence, examples, or at least acknowledged uncertainty.\n",
    "focus": [
      "claim strength and support",
      "logical consistency",
      "missing evidence or sources",
      "overgeneralization"
    ],
    "stops_when": "Never stops early — reads everything. But mentally\nchecks out if too many unsupported claims stack up.\n"
  },
  {
    "name": "The Scanner",
    "type": "core",
    "behavior": "Spends 30 seconds max deciding if this is worth their time.\nReads headline, opening line, scans visual structure and length.\nMakes a snap judgment: read or skip.\n",
    "focus": [
      "headline clarity",
      "opening hook strength",
      "visual density and structure",
      "length relative to perceived value"
    ],
    "stops_when": "Nothing grabs attention in the first 3 sentences,\nor the piece looks too long for the perceived payoff.\n"
  },
  {
    "name": "The Skimmer",
    "type": "core",
    "behavior": "Reads headings, bold text, and first sentence of each paragraph only.\nJumps between sections looking for the key takeaway.\nBuilds a mental summary from fragments, never reading full paragraphs.\n",
    "focus": [
      "heading informativeness",
      "bold/emphasized text placement",
      "first-sentence clarity per paragraph",
      "whether key ideas survive partial reading"
    ],
    "stops_when": "Headings are vague or missing, paragraphs blur together,\nor the piece requires sequential reading to make sense.\n"
  }
];

const DYNAMIC_PERSONAS = [
  {
    "name": "The Domain Outsider",
    "type": "dynamic",
    "behavior": "Has no background in the topic. Reads with genuine curiosity\nbut hits walls when the author assumes shared knowledge.\nJargon, acronyms, and insider references are barriers, not shortcuts.\n",
    "focus": [
      "unexplained jargon and acronyms",
      "assumed prior knowledge",
      "concepts introduced without definition",
      "insider references that exclude newcomers"
    ],
    "stops_when": "Too many unexplained terms stack up and the piece\nstarts feeling like it was written for someone else.\n"
  },
  {
    "name": "The Emotional Reader",
    "type": "dynamic",
    "behavior": "Reads with emotional antennae up. Notices tone shifts,\nempathy gaps, and moments where the author's perspective\nmight alienate readers with different experiences.\nSensitive to dismissiveness, condescension, and assumptions\nabout the reader's emotional state.\n",
    "focus": [
      "tone consistency and shifts",
      "empathy and inclusiveness",
      "dismissive or condescending language",
      "assumptions about reader's experience or feelings"
    ],
    "stops_when": "The tone feels preachy, condescending, or dismissive\nof experiences different from the author's.\n"
  },
  {
    "name": "The Literal Reader",
    "type": "dynamic",
    "behavior": "Takes everything at face value. Misses irony, sarcasm,\nand figurative language. Reads metaphors as literal statements\nand gets confused when the text doesn't mean what it says.\n",
    "focus": [
      "metaphors and figurative language",
      "irony and sarcasm",
      "implicit meaning that requires inference",
      "cultural references that assume shared context"
    ],
    "stops_when": "Accumulated confusion from figurative language makes\nthe piece feel incoherent or contradictory.\n"
  },
  {
    "name": "The Skeptic",
    "type": "dynamic",
    "behavior": "Approaches the piece with arms crossed. Not hostile, but needs\nto be convinced. Looks for credibility signals — credentials,\ndata, specific examples, acknowledged limitations.\n",
    "focus": [
      "credibility signals and authority markers",
      "specificity vs. vagueness",
      "acknowledged limitations and caveats",
      "whether recommendations are earned or assumed"
    ],
    "stops_when": "The author asks for trust without earning it,\nor makes recommendations without establishing credibility.\n"
  },
  {
    "name": "The Visualizer",
    "type": "dynamic",
    "behavior": "Builds mental images from descriptions and analogies.\nNotices when metaphors clash, images contradict each other,\nor analogies break down under scrutiny. Sensitive to visual\ncoherence in the writing.\n",
    "focus": [
      "metaphor consistency",
      "analogy accuracy and completeness",
      "visual imagery that contradicts itself",
      "mixed metaphors within or across paragraphs"
    ],
    "stops_when": "Mental images start contradicting each other,\nor an analogy is so forced it distracts from the point.\n"
  }
];

export function getCorePersonas() {
  return CORE_PERSONAS;
}

export function getDynamicPersonas() {
  return DYNAMIC_PERSONAS;
}

export function getAllPersonas() {
  return [...CORE_PERSONAS, ...DYNAMIC_PERSONAS];
}
