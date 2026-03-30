"""Output generation — Stage 5 of the pipeline."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

from first_misread.history import content_hash
from first_misread.models import (
    AggregatedFinding,
    ContentMetadata,
    FindingDiff,
    PersonaResult,
    PersonaVerdict,
    RevisionNotes,
    RewriteSuggestion,
    RunRecord,
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


STATUS_EMOJI = {
    "resolved": "\u2705",
    "new": "\U0001f534",
    "persists": "\u26a0\ufe0f",
    "regressed": "\U0001f534",
}


def generate_changes_section(
    diffs: list[FindingDiff],
    version_label: str,
) -> str:
    """Generate the 'Changes from previous run' markdown section."""
    lines = [
        f"## Changes from previous run ({version_label})",
        "",
    ]
    for d in diffs:
        emoji = STATUS_EMOJI.get(d.status, "")
        status = d.status.upper()

        if d.current_finding:
            passage = d.current_finding.passage[:80]
        elif d.parent_finding:
            passage = d.parent_finding.passage[:80]
        else:
            continue

        line = f"- {emoji} {status}: \"{passage}\""

        extras = []
        if d.run_streak > 1:
            extras.append(f"{d.run_streak} runs")
        if d.severity_change:
            extras.append(d.severity_change)
        if d.persona_count_change and d.persona_count_change != 0:
            sign = "+" if d.persona_count_change > 0 else ""
            extras.append(f"{sign}{d.persona_count_change} personas")

        if extras:
            line += f" ({', '.join(extras)})"

        lines.append(line)

    lines.append("")
    return "\n".join(lines)


def generate_revision_notes_md(notes: RevisionNotes) -> str:
    """Generate revision-notes.md markdown."""
    lines = ["# Revision Notes", ""]

    if notes.what_landed:
        lines.append("## What Landed")
        for item in notes.what_landed:
            lines.append(f"- {item}")
        lines.append("")

    if notes.what_persists:
        lines.append("## What Persists")
        for item in notes.what_persists:
            lines.append(f"- {item}")
        lines.append("")

    if notes.what_regressed:
        lines.append("## What Regressed")
        for item in notes.what_regressed:
            lines.append(f"- {item}")
        lines.append("")

    lines.append("## Revision Pattern")
    lines.append(notes.revision_pattern)
    lines.append("")

    lines.append("## Suggestion")
    lines.append(notes.suggestion)
    lines.append("")

    return "\n".join(lines)


def write_run_record(
    output_dir: Path,
    record: RunRecord,
    input_text: str,
) -> None:
    """Write run.json and input.md to the output directory."""
    (output_dir / "run.json").write_text(record.model_dump_json(indent=2))
    (output_dir / "input.md").write_text(input_text)


def write_output(
    base_dir: Path,
    slug: str,
    title: str,
    metadata: ContentMetadata,
    results: list[PersonaResult],
    aggregated: list[AggregatedFinding],
    rewrites: list[RewriteSuggestion] | None,
    total_personas: int,
    input_text: str = "",
    model: str = "",
    parent_run_id: str | None = None,
    diffs: list[FindingDiff] | None = None,
    revision_notes: RevisionNotes | None = None,
    version_label: str = "",
) -> Path:
    """Write all output files and return the output directory."""
    now = datetime.now()
    timestamp = now.strftime("%Y-%m-%d-%H%M%S")
    output_dir = base_dir / f"{timestamp}-{slug}"
    output_dir.mkdir(parents=True, exist_ok=True)

    summary = generate_summary(title, metadata, results, aggregated, total_personas)

    if diffs and version_label:
        changes = generate_changes_section(diffs, version_label)
        summary = changes + "\n" + summary

    (output_dir / "summary.md").write_text(summary)

    details = generate_persona_details(results)
    (output_dir / "persona-details.md").write_text(details)

    if rewrites:
        rewrites_md = generate_rewrites_md(rewrites)
        (output_dir / "rewrites.md").write_text(rewrites_md)

    if revision_notes:
        revision_md = generate_revision_notes_md(revision_notes)
        (output_dir / "revision-notes.md").write_text(revision_md)

    run_id = f"{timestamp}-{slug}"
    verdicts = [
        PersonaVerdict(
            persona=r.persona,
            verdict=r.overall_verdict,
            key_issue=r.findings[0].what_happened if r.findings else "No issues",
        )
        for r in results
    ]
    record = RunRecord(
        run_id=run_id,
        timestamp=now.isoformat(),
        slug=slug,
        content_hash=content_hash(input_text) if input_text else "",
        word_count=metadata.word_count,
        model=model,
        personas_run=[r.persona for r in results],
        parent_run_id=parent_run_id,
        metadata=metadata,
        findings=aggregated,
        persona_verdicts=verdicts,
    )
    write_run_record(output_dir, record, input_text)

    return output_dir
