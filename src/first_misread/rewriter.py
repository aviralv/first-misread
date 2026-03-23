"""Rewrite suggestions — Stage 4b of the pipeline."""

from __future__ import annotations

import logging

from first_misread.claude_client import ClaudeClient
from first_misread.models import AggregatedFinding, RewriteSuggestion

logger = logging.getLogger(__name__)

REWRITER_SYSTEM_PROMPT = """You are an editor helping improve written content. You'll receive the original text and a list of passages that confused readers, along with what went wrong.

For each flagged passage, suggest a minimal rewrite that fixes the misread risk while preserving the author's voice. Change as little as possible.

Return JSON:
{
  "rewrites": [
    {
      "original_passage": "The exact original text",
      "problem_summary": "One sentence explaining the issue",
      "suggested_rewrite": "The improved version",
      "personas_that_flagged": ["Persona A", "Persona B"]
    }
  ]
}"""


async def generate_rewrites(
    client: ClaudeClient,
    text: str,
    findings: list[AggregatedFinding],
) -> list[RewriteSuggestion]:
    """Generate rewrite suggestions for flagged passages."""
    findings_desc = "\n\n".join(
        f"**Passage:** \"{f.passage}\"\n"
        f"**Severity:** {f.severity} ({f.signal_strength})\n"
        f"**Issues:** " + "; ".join(d["what_happened"] for d in f.descriptions)
        for f in findings
    )

    user_prompt = f"""## Original text

{text}

## Flagged passages

{findings_desc}"""

    result = await client.call(system=REWRITER_SYSTEM_PROMPT, user=user_prompt)

    if not result or "rewrites" not in result:
        logger.warning("Rewrite generation failed")
        return []

    try:
        return [RewriteSuggestion(**r) for r in result["rewrites"]]
    except Exception as e:
        logger.warning(f"Invalid rewrite response: {e}")
        return []
