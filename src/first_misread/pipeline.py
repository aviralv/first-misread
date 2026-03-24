"""Main pipeline orchestrator — runs all 5 stages."""

from __future__ import annotations

import re
from pathlib import Path

from first_misread.analyzer import analyze_content
from first_misread.aggregator import aggregate_findings
from first_misread.claude_client import ClaudeClient
from first_misread.output import write_output
from first_misread.personas import load_all_personas
from first_misread.rewriter import generate_rewrites
from first_misread.selector import select_dynamic_personas
from first_misread.simulator import simulate_all

MIN_WORDS = 50
MAX_WORDS = 2500


def validate_input(text: str) -> str:
    """Validate input text is within bounds."""
    text = text.strip()
    word_count = len(text.split())
    if word_count < MIN_WORDS:
        raise ValueError(f"Input too short: {word_count} words (minimum {MIN_WORDS})")
    if word_count > MAX_WORDS:
        raise ValueError(f"Input too long: {word_count} words (maximum {MAX_WORDS})")
    return text


def make_slug(
    file_path: Path | None = None,
    text: str | None = None,
) -> str:
    """Generate a slug for the output directory."""
    if file_path:
        return file_path.stem
    if text:
        words = re.sub(r"[^\w\s]", "", text).lower().split()[:5]
        return "-".join(words)
    return "untitled"


async def run_pipeline(
    text: str,
    personas_dir: Path,
    output_dir: Path,
    client: ClaudeClient | None = None,
    include_rewrites: bool = True,
    file_path: Path | None = None,
) -> Path:
    """Run the full First Misread pipeline."""
    client = client or ClaudeClient()

    # Stage 1: Input
    text = validate_input(text)
    slug = make_slug(file_path=file_path, text=text)
    title = (
        file_path.stem.replace("-", " ").replace("_", " ").capitalize()
        if file_path
        else slug.replace("-", " ").capitalize()
    )

    # Stage 2: Content Analysis
    metadata = analyze_content(text)

    # Stage 3: Persona Selection
    core, dynamic, custom = load_all_personas(personas_dir)
    selected_dynamic = await select_dynamic_personas(
        client=client,
        text=text,
        metadata=metadata,
        available_dynamic=dynamic,
    )

    all_personas = core + custom + selected_dynamic
    total_personas = len(all_personas)

    # Stage 4: Reading Simulation
    results = await simulate_all(
        client=client,
        personas=all_personas,
        text=text,
        metadata=metadata,
    )

    # Aggregate findings
    aggregated = aggregate_findings(results)

    # Stage 4b: Rewrite Pass (optional)
    rewrites = None
    if include_rewrites and aggregated:
        rewrites = await generate_rewrites(
            client=client,
            text=text,
            findings=aggregated,
        )

    # Stage 5: Output
    result_dir = write_output(
        base_dir=output_dir,
        slug=slug,
        title=title,
        metadata=metadata,
        results=results,
        aggregated=aggregated,
        rewrites=rewrites,
        total_personas=total_personas,
    )

    return result_dir
