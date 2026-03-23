"""Output generation — Stage 5 of the pipeline."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

from first_misread.models import (
    AggregatedFinding,
    ContentMetadata,
    PersonaResult,
    RewriteSuggestion,
)

SEVERITY_EMOJI = {"high": "\U0001f534", "medium": "\U0001f7e1", "low": "\u26aa"}


def generate_summary(
    title: str,
    metadata: ContentMetadata,
    results: list[PersonaResult],
    aggregated: list[AggregatedFinding],
    total_personas: int,
) -> str:
    """Generate L1 summary markdown."""
    lines = [
        "# First Misread Report",
        "",
        f"**Content**: \"{title}\"",
        f"**Word count**: {metadata.word_count:,} | **Est. read time**: {metadata.estimated_read_time_minutes} min",
        f"**Personas run**: {total_personas} total",
        "",
        "## Top Findings",
        "",
    ]

    for i, finding in enumerate(aggregated[:5], 1):
        emoji = SEVERITY_EMOJI.get(finding.severity, "")
        lines.append(f"{i}. **{emoji} {finding.descriptions[0]['what_happened']}** ({finding.signal_strength})")
        lines.append(f"   > \"{finding.passage}\"")
        persona_summary = ", ".join(finding.personas)
        lines.append(f"   Flagged by: {persona_summary}")
        lines.append("")

    lines.append("## Persona Verdicts")
    lines.append("")
    lines.append("| Persona | Verdict | Key Issue |")
    lines.append("|---------|---------|-----------|")
    for result in results:
        key_issue = result.findings[0].what_happened if result.findings else "No issues"
        lines.append(f"| {result.persona} | {result.overall_verdict} | {key_issue} |")
    lines.append("")

    return "\n".join(lines)


def generate_persona_details(results: list[PersonaResult]) -> str:
    """Generate L2 per-persona breakdown markdown."""
    lines = ["# Persona Details", ""]

    for result in results:
        lines.append(f"## {result.persona}")
        lines.append("")
        lines.append(f"**Behavior:** {result.behavior_executed}")
        lines.append(f"**Time spent:** {result.time_simulated}")
        lines.append(f"**Verdict:** {result.overall_verdict}")
        lines.append("")

        if not result.findings:
            lines.append("*No issues found.*")
            lines.append("")
            continue

        lines.append("### Findings")
        lines.append("")
        for f in result.findings:
            emoji = SEVERITY_EMOJI.get(f.severity, "")
            lines.append(f"#### {emoji} {f.type.replace('_', ' ').title()} ({f.severity})")
            lines.append("")
            lines.append(f"> \"{f.passage}\"")
            lines.append(f"")
            lines.append(f"**Location:** {f.location}")
            lines.append(f"**What happened:** {f.what_happened}")
            lines.append(f"**Persona understood:** {f.what_persona_understood}")
            lines.append(f"**Author likely meant:** {f.what_author_likely_meant}")
            lines.append("")

        lines.append("---")
        lines.append("")

    return "\n".join(lines)


def generate_rewrites_md(rewrites: list[RewriteSuggestion]) -> str:
    """Generate L3 rewrite suggestions markdown."""
    lines = ["# Rewrite Suggestions", ""]

    for i, r in enumerate(rewrites, 1):
        lines.append(f"## {i}. {r.problem_summary}")
        lines.append("")
        lines.append(f"**Flagged by:** {', '.join(r.personas_that_flagged)}")
        lines.append("")
        lines.append("**Original:**")
        lines.append(f"> {r.original_passage}")
        lines.append("")
        lines.append("**Suggested:**")
        lines.append(f"> {r.suggested_rewrite}")
        lines.append("")
        lines.append("---")
        lines.append("")

    return "\n".join(lines)


def write_output(
    base_dir: Path,
    slug: str,
    title: str,
    metadata: ContentMetadata,
    results: list[PersonaResult],
    aggregated: list[AggregatedFinding],
    rewrites: list[RewriteSuggestion] | None,
    total_personas: int,
) -> Path:
    """Write all output files and return the output directory."""
    timestamp = datetime.now().strftime("%Y-%m-%d-%H%M%S")
    output_dir = base_dir / f"{timestamp}-{slug}"
    output_dir.mkdir(parents=True, exist_ok=True)

    summary = generate_summary(title, metadata, results, aggregated, total_personas)
    (output_dir / "summary.md").write_text(summary)

    details = generate_persona_details(results)
    (output_dir / "persona-details.md").write_text(details)

    if rewrites:
        rewrites_md = generate_rewrites_md(rewrites)
        (output_dir / "rewrites.md").write_text(rewrites_md)

    return output_dir
