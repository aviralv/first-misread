import pytest
from first_misread.aggregator import aggregate_findings
from first_misread.models import Finding, PersonaResult, AggregatedFinding


def make_result(persona: str, findings: list[Finding]) -> PersonaResult:
    return PersonaResult(
        persona=persona,
        behavior_executed="test",
        time_simulated="10s",
        overall_verdict="test",
        findings=findings,
    )


def test_no_duplicates():
    results = [
        make_result("Scanner", [
            Finding(type="lost_interest", severity="high", passage="Unique passage A",
                    location="p1", what_happened="x", what_persona_understood="x", what_author_likely_meant="x"),
        ]),
        make_result("Skimmer", [
            Finding(type="confusion", severity="medium", passage="Completely different B",
                    location="p2", what_happened="y", what_persona_understood="y", what_author_likely_meant="y"),
        ]),
    ]
    aggregated = aggregate_findings(results)
    assert len(aggregated) == 2
    assert all(len(a.personas) == 1 for a in aggregated)


def test_duplicates_merged():
    passage = "In my experience building products across three companies"
    results = [
        make_result("Scanner", [
            Finding(type="lost_interest", severity="high", passage=passage,
                    location="p1s1", what_happened="bounced", what_persona_understood="x", what_author_likely_meant="y"),
        ]),
        make_result("Busy Reader", [
            Finding(type="lost_interest", severity="medium", passage=passage,
                    location="p1s1", what_happened="skipped", what_persona_understood="a", what_author_likely_meant="b"),
        ]),
    ]
    aggregated = aggregate_findings(results)
    assert len(aggregated) == 1
    assert len(aggregated[0].personas) == 2
    assert aggregated[0].severity == "high"  # takes highest


def test_partial_overlap_merged():
    results = [
        make_result("Scanner", [
            Finding(type="lost_interest", severity="high",
                    passage="In my experience building products across three companies and many teams",
                    location="p1", what_happened="x", what_persona_understood="x", what_author_likely_meant="x"),
        ]),
        make_result("Skimmer", [
            Finding(type="lost_interest", severity="medium",
                    passage="In my experience building products across three companies",
                    location="p1", what_happened="y", what_persona_understood="y", what_author_likely_meant="y"),
        ]),
    ]
    aggregated = aggregate_findings(results)
    assert len(aggregated) == 1


def test_sorted_by_severity_then_signal():
    results = [
        make_result("A", [
            Finding(type="confusion", severity="low", passage="Low sev",
                    location="p3", what_happened="x", what_persona_understood="x", what_author_likely_meant="x"),
        ]),
        make_result("B", [
            Finding(type="confusion", severity="high", passage="High sev",
                    location="p1", what_happened="x", what_persona_understood="x", what_author_likely_meant="x"),
        ]),
    ]
    aggregated = aggregate_findings(results)
    assert aggregated[0].severity == "high"
