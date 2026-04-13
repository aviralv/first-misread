"""Thin async wrapper for Claude API calls."""

from __future__ import annotations

import asyncio
import json
import logging
import os

from anthropic import AsyncAnthropic

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "claude-sonnet-4-6"


def _strip_code_fences(text: str) -> str:
    """Strip markdown code fences from JSON responses."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        # Remove opening fence (```json or ```)
        lines = lines[1:]
        # Remove closing fence
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text


def _extract_json(text: str) -> str:
    """Extract JSON from Claude response that may contain preamble text.

    Tries in order:
    1. Strip code fences (handles ```json ... ```)
    2. Direct parse (already valid JSON)
    3. Find first { or [ and extract the outermost JSON object/array
    """
    stripped = _strip_code_fences(text)

    # Fast path: already valid JSON after fence stripping
    try:
        json.loads(stripped)
        return stripped
    except (json.JSONDecodeError, ValueError):
        pass

    # Find the first { or [ and try to extract balanced JSON
    for start_char, end_char in [("{", "}"), ("[", "]")]:
        start = stripped.find(start_char)
        if start == -1:
            continue
        end = stripped.rfind(end_char)
        if end <= start:
            continue
        candidate = stripped[start:end + 1]
        try:
            json.loads(candidate)
            return candidate
        except (json.JSONDecodeError, ValueError):
            continue

    # Nothing worked — return the fence-stripped text so caller gets the
    # original JSONDecodeError with context
    return stripped


class ClaudeClient:
    """Async Claude API client with retry and JSON parsing."""

    def __init__(
        self,
        client: AsyncAnthropic | None = None,
        model: str | None = None,
        max_retries: int = 1,
    ):
        self.client = client or AsyncAnthropic(
            api_key=os.environ.get("ANTHROPIC_API_KEY"),
            base_url=os.environ.get("ANTHROPIC_BASE_URL") or None,
        )
        self.model = model or os.environ.get("FIRST_MISREAD_MODEL", DEFAULT_MODEL)
        self.max_retries = max_retries

    async def call(
        self,
        system: str,
        user: str,
        max_tokens: int = 4096,
    ) -> dict | None:
        """Make a Claude API call and return parsed JSON, or None on failure."""
        raw_text = ""
        for attempt in range(self.max_retries + 1):
            try:
                response = await self.client.messages.create(
                    model=self.model,
                    max_tokens=max_tokens,
                    system=system,
                    messages=[{"role": "user", "content": user}],
                )
                raw_text = response.content[0].text
                text = _extract_json(raw_text)
                return json.loads(text)
            except json.JSONDecodeError as e:
                logger.warning(
                    "Invalid JSON from Claude (attempt %d): %s\nRaw response: %.500s",
                    attempt + 1, e, raw_text,
                )
                if attempt < self.max_retries:
                    await asyncio.sleep(2 ** attempt)
                else:
                    return None
            except Exception as e:
                if attempt < self.max_retries:
                    logger.warning(f"Claude API error (attempt {attempt + 1}): {e}")
                    await asyncio.sleep(2 ** attempt)
                else:
                    logger.error(f"Claude API failed after {self.max_retries + 1} attempts: {e}")
                    return None
