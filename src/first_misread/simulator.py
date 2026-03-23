"""Reading simulation — Stage 4 of the pipeline."""

from __future__ import annotations

import asyncio
import logging

from first_misread.claude_client import ClaudeClient
from first_misread.models import ContentMetadata, PersonaConfig, PersonaResult

logger = logging.getLogger(__name__)

SIMULATION_SYSTEM_PROMPT = """You are simulating a specific reader persona. Read the text below exactly as this persona would — follow their behavior, focus on what they focus on, stop when they'd stop.

Return your findings as JSON with this exact structure:
{
  "persona": "Persona Name",
  "behavior_executed": "What you actually did while reading",
  "time_simulated": "How long this persona would spend",
  "overall_verdict": "One-sentence summary of this persona's experience",
  "findings": [
    {
      "type": "confusion | lost_interest | misread | skipped",
      "severity": "high | medium | low",
      "passage": "The exact text that caused the issue",
      "location": "paragraph N, sentence N",
      "what_happened": "Description of the problem",
      "what_persona_understood": "What the persona took away",
      "what_author_likely_meant": "What the author probably intended"
    }
  ]
}

If this persona would have no issues, return an empty findings array. Be honest — don't invent problems that wouldn't occur for this reading behavior."""


async def simulate_persona(
    client: ClaudeClient,
    persona: PersonaConfig,
    text: str,
    metadata: ContentMetadata,
) -> PersonaResult | None:
    """Run a single persona simulation."""
    user_prompt = f"""## Persona: {persona.name}

**Behavior:** {persona.behavior}

**Focus areas:** {", ".join(persona.focus)}

**Stops when:** {persona.stops_when}

## Content metadata
Word count: {metadata.word_count} | Read time: {metadata.estimated_read_time_minutes} min
Paragraphs: {metadata.paragraph_count} | Headings: {metadata.heading_count}

## Text to read

{text}"""

    result = await client.call(system=SIMULATION_SYSTEM_PROMPT, user=user_prompt)

    if result is None:
        logger.warning(f"Simulation failed for persona: {persona.name}")
        return None

    try:
        return PersonaResult(**result)
    except Exception as e:
        logger.warning(f"Invalid response from {persona.name}: {e}")
        return None


async def simulate_all(
    client: ClaudeClient,
    personas: list[PersonaConfig],
    text: str,
    metadata: ContentMetadata,
) -> list[PersonaResult]:
    """Run all persona simulations in parallel. Skips failures."""
    tasks = [
        simulate_persona(client, persona, text, metadata)
        for persona in personas
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    valid = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            logger.warning(f"Persona {personas[i].name} raised: {result}")
        elif result is not None:
            valid.append(result)

    return valid
