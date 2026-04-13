import pytest
from pathlib import Path
from first_misread.output import generate_summary, generate_persona_details, generate_rewrites_md, write_output
from first_misread.models import (
    ContentMetadata, PersonaResult, Finding, AggregatedFinding, RewriteSuggestion, Strength,
)


@pytest.fixture
def metadata():
    return ContentMetadata(
        word_count=1240, estimated_read_time_minutes=6.2,
        paragraph_count=10, heading_count=3,
        has_lists=True, has_links=False,
        sentence_count=60, avg_sentence_length=20.7,
    )


@pytest.fixture
def persona_results():
    return [
        PersonaResult(
            persona="The Scanner",
            behavior_executed="Scanned headline",
            time_simulated="12 seconds",
            overall_verdict="Would not read further",
            findings=[
                Finding(type="lost_interest", severity="high",
                        passage="In my experience", location="p1s1",
                        what_happened="Generic opening",
                        what_persona_understood="A blog post",
                        what_author_likely_meant="Setting context"),
            ],
        ),
    ]


@pytest.fixture
def aggregated():
    return [
        AggregatedFinding(
            passage="In my experience", location="p1s1",
            severity="high", personas=["The Scanner"],
            descriptions=[{"persona": "The Scanner", "what_happened": "Generic opening"}],
        ),
    ]


@pytest.fixture
def rewrites():
    return [
        RewriteSuggestion(
            original_passage="In my experience",
            problem_summary="Generic opening",
            suggested_rewrite="Most product roadmaps fail.",
            personas_that_flagged=["The Scanner"],
        ),
    ]


def test_generate_summary(metadata, persona_results, aggregated):
    md = generate_summary(
        title="Test Post", metadata=metadata,
        results=persona_results, aggregated=aggregated,
        total_personas=5,
    )
    assert "# First Misread Report" in md
    assert "1,240" in md
    assert "The Scanner" in md


def test_generate_persona_details(persona_results):
    md = generate_persona_details(persona_results)
    assert "The Scanner" in md
    assert "Generic opening" in md


def test_generate_rewrites_md(rewrites):
    md = generate_rewrites_md(rewrites)
    assert "In my experience" in md
    assert "Most product roadmaps fail." in md


def test_write_output(tmp_path, metadata, persona_results, aggregated, rewrites):
    output_dir = write_output(
        base_dir=tmp_path, slug="test-post",
        title="Test Post", metadata=metadata,
        results=persona_results, aggregated=aggregated,
        rewrites=rewrites, total_personas=5,
    )
    assert (output_dir / "summary.md").exists()
    assert (output_dir / "persona-details.md").exists()
    assert (output_dir / "rewrites.md").exists()


def test_write_output_no_rewrites(tmp_path, metadata, persona_results, aggregated):
    output_dir = write_output(
        base_dir=tmp_path, slug="test-post",
        title="Test Post", metadata=metadata,
        results=persona_results, aggregated=aggregated,
        rewrites=None, total_personas=5,
    )
    assert (output_dir / "summary.md").exists()
    assert (output_dir / "persona-details.md").exists()
    assert not (output_dir / "rewrites.md").exists()


import json

from first_misread.models import (
    FindingDiff,
    PersonaVerdict,
    RevisionNotes,
    RunRecord,
)
from first_misread.output import (
    generate_changes_section,
    generate_revision_notes_md,
    write_run_record,
)


def _make_finding_for_output(passage: str, severity: str = "high") -> AggregatedFinding:
    return AggregatedFinding(
        passage=passage, location="p1", severity=severity,
        personas=["Scanner"],
        descriptions=[{"persona": "Scanner", "what_happened": "flagged"}],
    )


def test_generate_changes_section():
    diffs = [
        FindingDiff(
            status="resolved",
            parent_finding=_make_finding_for_output("I-to-you pivot"),
            run_streak=0,
        ),
        FindingDiff(
            status="new",
            current_finding=_make_finding_for_output("CTA line"),
            run_streak=0,
        ),
        FindingDiff(
            status="persists",
            current_finding=_make_finding_for_output("Opening redefinition"),
            parent_finding=_make_finding_for_output("Opening redefinition", severity="medium"),
            severity_change="escalated",
            persona_count_change=2,
            run_streak=3,
        ),
    ]
    section = generate_changes_section(diffs, version_label="v2 → v3")
    assert "RESOLVED" in section
    assert "NEW" in section
    assert "PERSISTS" in section
    assert "I-to-you pivot" in section
    assert "3 runs" in section
    assert "v2 → v3" in section


def test_generate_revision_notes_md():
    notes = RevisionNotes(
        what_landed=["Fixed the throat-clearing"],
        what_persists=["No headings"],
        what_regressed=["Opening got worse"],
        revision_pattern="Word-level hedges instead of structural changes",
        suggestion="Add one heading before backstory",
    )
    md = generate_revision_notes_md(notes)
    assert "# Revision Notes" in md
    assert "Fixed the throat-clearing" in md
    assert "Word-level hedges" in md
    assert "Add one heading" in md


def test_write_run_record(tmp_path):
    metadata = ContentMetadata(
        word_count=500, estimated_read_time_minutes=2.5,
        paragraph_count=8, heading_count=0, has_lists=False,
        has_links=True, sentence_count=25, avg_sentence_length=20.0,
    )
    record = RunRecord(
        run_id="test-run",
        timestamp="2026-03-26T10:13:13",
        slug="test",
        content_hash="abc",
        word_count=500,
        model="claude-sonnet-4-6",
        personas_run=["Scanner"],
        parent_run_id=None,
        metadata=metadata,
        findings=[_make_finding_for_output("Test issue")],
        persona_verdicts=[
            PersonaVerdict(persona="Scanner", verdict="ok", key_issue="none"),
        ],
    )
    write_run_record(tmp_path, record, input_text="Hello world")

    run_json = tmp_path / "run.json"
    assert run_json.exists()
    data = json.loads(run_json.read_text())
    assert data["run_id"] == "test-run"
    assert data["findings"][0]["passage"] == "Test issue"

    input_md = tmp_path / "input.md"
    assert input_md.exists()
    assert input_md.read_text() == "Hello world"


def test_write_output_includes_run_record(tmp_path):
    metadata = ContentMetadata(
        word_count=500, estimated_read_time_minutes=2.5,
        paragraph_count=8, heading_count=0, has_lists=False,
        has_links=True, sentence_count=25, avg_sentence_length=20.0,
    )
    results = [
        PersonaResult(
            persona="Scanner", behavior_executed="scanned",
            time_simulated="30s", overall_verdict="ok", findings=[],
        )
    ]
    aggregated = [_make_finding_for_output("Test")]

    result_dir = write_output(
        base_dir=tmp_path,
        slug="test",
        title="Test",
        metadata=metadata,
        results=results,
        aggregated=aggregated,
        rewrites=None,
        total_personas=1,
        input_text="Hello world",
        model="claude-sonnet-4-6",
    )

    assert (result_dir / "run.json").exists()
    assert (result_dir / "input.md").exists()
    assert (result_dir / "summary.md").exists()


def test_generate_summary_with_strengths(metadata, persona_results, aggregated):
    strengths = [
        Strength(passage="The word moves.", location="paragraph 8", why="Crystallizes the argument."),
        Strength(passage="Not all silence is absence.", location="paragraph 3", why="Anchors the emotional turn."),
    ]
    md = generate_summary(
        title="Test Post", metadata=metadata,
        results=persona_results, aggregated=aggregated,
        total_personas=5, strengths=strengths,
    )
    assert "## What's Landing" in md
    assert "The word moves." in md
    assert "Crystallizes the argument." in md
    assert "Not all silence is absence." in md
    top_idx = md.index("## Top Findings")
    landing_idx = md.index("## What's Landing")
    verdict_idx = md.index("## Persona Verdicts")
    assert top_idx < landing_idx < verdict_idx


def test_generate_summary_without_strengths(metadata, persona_results, aggregated):
    md = generate_summary(
        title="Test Post", metadata=metadata,
        results=persona_results, aggregated=aggregated,
        total_personas=5, strengths=None,
    )
    assert "## What's Landing" not in md
