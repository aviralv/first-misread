import pytest
from pathlib import Path
from first_misread.output import generate_summary, generate_persona_details, generate_rewrites_md, write_output
from first_misread.models import (
    ContentMetadata, PersonaResult, Finding, AggregatedFinding, RewriteSuggestion,
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
