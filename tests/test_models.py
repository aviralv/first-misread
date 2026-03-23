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
