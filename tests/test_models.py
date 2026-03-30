import pytest
from first_misread.models import (
    PersonaConfig,
    ContentMetadata,
    Finding,
    PersonaResult,
    AggregatedFinding,
    RewriteSuggestion,
)


def test_persona_config_from_dict():
    data = {
        "name": "The Scanner",
        "type": "core",
        "behavior": "Spends 30 seconds deciding.",
        "focus": ["headline clarity", "opening hook"],
        "stops_when": "Nothing grabs attention.",
    }
    config = PersonaConfig(**data)
    assert config.name == "The Scanner"
    assert config.type == "core"
    assert len(config.focus) == 2


def test_content_metadata():
    meta = ContentMetadata(
        word_count=500,
        estimated_read_time_minutes=2.5,
        paragraph_count=6,
        heading_count=2,
        has_lists=True,
        has_links=False,
        sentence_count=25,
        avg_sentence_length=20.0,
    )
    assert meta.word_count == 500


def test_finding():
    f = Finding(
        type="confusion",
        severity="high",
        passage="Some text here",
        location="paragraph 1, sentence 2",
        what_happened="Reader was confused",
        what_persona_understood="X",
        what_author_likely_meant="Y",
    )
    assert f.severity == "high"


def test_persona_result():
    result = PersonaResult(
        persona="The Scanner",
        behavior_executed="Scanned headline",
        time_simulated="12 seconds",
        overall_verdict="Would not read further",
        findings=[],
    )
    assert result.persona == "The Scanner"
    assert result.findings == []


def test_aggregated_finding():
    af = AggregatedFinding(
        passage="Some text",
        location="paragraph 1",
        severity="high",
        personas=["Scanner", "Skimmer"],
        descriptions=[
            {"persona": "Scanner", "what_happened": "Bounced"},
            {"persona": "Skimmer", "what_happened": "Skipped"},
        ],
    )
    assert af.signal_strength == "flagged by 2 personas"


def test_finding_type_validation():
    with pytest.raises(Exception):
        Finding(
            type="invalid_type",
            severity="high",
            passage="text",
            location="p1",
            what_happened="x",
            what_persona_understood="x",
            what_author_likely_meant="x",
        )


from first_misread.models import (
    PersonaVerdict,
    RunRecord,
    FindingDiff,
    RevisionNotes,
    ContentMetadata,
    AggregatedFinding,
)


def test_persona_verdict_creation():
    v = PersonaVerdict(
        persona="The Scanner",
        verdict="Strong hook but no headings broke momentum",
        key_issue="No visual structure for scanning",
    )
    assert v.persona == "The Scanner"
    assert v.verdict == "Strong hook but no headings broke momentum"
    assert v.key_issue == "No visual structure for scanning"


def test_run_record_creation():
    metadata = ContentMetadata(
        word_count=500,
        estimated_read_time_minutes=2.5,
        paragraph_count=8,
        heading_count=0,
        has_lists=False,
        has_links=True,
        sentence_count=25,
        avg_sentence_length=20.0,
    )
    record = RunRecord(
        run_id="2026-03-26-101313-compassion-linkedin",
        timestamp="2026-03-26T10:13:13",
        slug="compassion-linkedin",
        content_hash="abc123",
        word_count=500,
        model="claude-sonnet-4-6",
        personas_run=["The Scanner", "The Skimmer"],
        parent_run_id=None,
        metadata=metadata,
        findings=[],
        persona_verdicts=[
            PersonaVerdict(persona="The Scanner", verdict="ok", key_issue="none"),
        ],
    )
    assert record.run_id == "2026-03-26-101313-compassion-linkedin"
    assert record.parent_run_id is None
    assert len(record.persona_verdicts) == 1


def test_run_record_with_parent():
    metadata = ContentMetadata(
        word_count=500,
        estimated_read_time_minutes=2.5,
        paragraph_count=8,
        heading_count=0,
        has_lists=False,
        has_links=True,
        sentence_count=25,
        avg_sentence_length=20.0,
    )
    record = RunRecord(
        run_id="2026-03-26-104055-compassion-linkedin-v2",
        timestamp="2026-03-26T10:40:55",
        slug="compassion-linkedin-v2",
        content_hash="def456",
        word_count=490,
        model="claude-sonnet-4-6",
        personas_run=["The Scanner"],
        parent_run_id="2026-03-26-101313-compassion-linkedin",
        metadata=metadata,
        findings=[],
        persona_verdicts=[],
    )
    assert record.parent_run_id == "2026-03-26-101313-compassion-linkedin"


def test_run_record_serialization_roundtrip():
    metadata = ContentMetadata(
        word_count=500,
        estimated_read_time_minutes=2.5,
        paragraph_count=8,
        heading_count=0,
        has_lists=False,
        has_links=True,
        sentence_count=25,
        avg_sentence_length=20.0,
    )
    finding = AggregatedFinding(
        passage="Test passage",
        location="paragraph 1",
        severity="high",
        personas=["The Scanner"],
        descriptions=[{"persona": "The Scanner", "what_happened": "bounced"}],
    )
    record = RunRecord(
        run_id="test-run",
        timestamp="2026-03-26T10:13:13",
        slug="test",
        content_hash="abc",
        word_count=500,
        model="claude-sonnet-4-6",
        personas_run=["The Scanner"],
        parent_run_id=None,
        metadata=metadata,
        findings=[finding],
        persona_verdicts=[],
    )
    json_str = record.model_dump_json(indent=2)
    restored = RunRecord.model_validate_json(json_str)
    assert restored.run_id == record.run_id
    assert restored.findings[0].passage == "Test passage"
    assert restored.findings[0].signal_strength == "flagged by 1 persona"


def test_finding_diff_new():
    finding = AggregatedFinding(
        passage="New issue", location="p1", severity="high",
        personas=["Scanner"],
        descriptions=[{"persona": "Scanner", "what_happened": "problem"}],
    )
    diff = FindingDiff(
        status="new",
        current_finding=finding,
        parent_finding=None,
        severity_change=None,
        persona_count_change=None,
        run_streak=0,
    )
    assert diff.status == "new"
    assert diff.parent_finding is None
    assert diff.run_streak == 0


def test_finding_diff_persists():
    current = AggregatedFinding(
        passage="Same issue", location="p1", severity="high",
        personas=["Scanner", "Skimmer", "Challenger"],
        descriptions=[{"persona": "Scanner", "what_happened": "still bad"}],
    )
    parent = AggregatedFinding(
        passage="Same issue", location="p1", severity="medium",
        personas=["Scanner"],
        descriptions=[{"persona": "Scanner", "what_happened": "bad"}],
    )
    diff = FindingDiff(
        status="persists",
        current_finding=current,
        parent_finding=parent,
        severity_change="escalated",
        persona_count_change=2,
        run_streak=3,
    )
    assert diff.status == "persists"
    assert diff.severity_change == "escalated"
    assert diff.run_streak == 3


def test_finding_diff_resolved():
    parent = AggregatedFinding(
        passage="Fixed issue", location="p2", severity="high",
        personas=["Challenger"],
        descriptions=[{"persona": "Challenger", "what_happened": "unsupported"}],
    )
    diff = FindingDiff(
        status="resolved",
        current_finding=None,
        parent_finding=parent,
        severity_change=None,
        persona_count_change=None,
        run_streak=0,
    )
    assert diff.status == "resolved"
    assert diff.current_finding is None


def test_revision_notes_creation():
    notes = RevisionNotes(
        what_landed=["Fixed the throat-clearing paragraph"],
        what_persists=["No headings — Scanner bounced again"],
        what_regressed=["Opening redefinition escalated from 3 to 5 personas"],
        revision_pattern="Word-level hedges instead of structural changes",
        suggestion="Add one heading before the personal backstory section",
    )
    assert len(notes.what_landed) == 1
    assert "hedges" in notes.revision_pattern
