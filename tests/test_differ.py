from first_misread.differ import diff_findings
from first_misread.models import AggregatedFinding, FindingDiff, RunRecord, ContentMetadata, PersonaVerdict


def _make_finding(
    passage: str,
    severity: str = "high",
    personas: list[str] | None = None,
) -> AggregatedFinding:
    personas = personas or ["Scanner"]
    return AggregatedFinding(
        passage=passage,
        location="paragraph 1",
        severity=severity,
        personas=personas,
        descriptions=[
            {"persona": p, "what_happened": f"{p} flagged this"}
            for p in personas
        ],
    )


def _make_metadata() -> ContentMetadata:
    return ContentMetadata(
        word_count=500, estimated_read_time_minutes=2.5,
        paragraph_count=8, heading_count=0, has_lists=False,
        has_links=True, sentence_count=25, avg_sentence_length=20.0,
    )


def _make_run_record(
    run_id: str,
    findings: list[AggregatedFinding],
    parent_run_id: str | None = None,
) -> RunRecord:
    return RunRecord(
        run_id=run_id,
        timestamp="2026-03-26T10:13:13",
        slug="test",
        content_hash="abc",
        word_count=500,
        model="claude-sonnet-4-6",
        personas_run=["Scanner"],
        parent_run_id=parent_run_id,
        metadata=_make_metadata(),
        findings=findings,
        persona_verdicts=[],
    )


def test_all_new_findings_when_no_parent():
    current = [_make_finding("Issue A"), _make_finding("Issue B")]
    diffs = diff_findings(current_findings=current, chain=[])
    assert len(diffs) == 2
    assert all(d.status == "new" for d in diffs)
    assert all(d.run_streak == 0 for d in diffs)


def test_persists_when_same_passage():
    parent_finding = _make_finding("The opening line feels unearned", severity="medium", personas=["Scanner"])
    current_finding = _make_finding("The opening line feels unearned", severity="high", personas=["Scanner", "Challenger"])

    parent = _make_run_record("run-1", [parent_finding])
    diffs = diff_findings(current_findings=[current_finding], chain=[parent])

    assert len(diffs) == 1
    assert diffs[0].status == "persists"
    assert diffs[0].severity_change == "escalated"
    assert diffs[0].persona_count_change == 1
    assert diffs[0].run_streak == 2


def test_resolved_when_parent_finding_gone():
    parent_finding = _make_finding("The I-to-you pivot")
    parent = _make_run_record("run-1", [parent_finding])

    current_finding = _make_finding("Completely different issue")
    diffs = diff_findings(current_findings=[current_finding], chain=[parent])

    resolved = [d for d in diffs if d.status == "resolved"]
    assert len(resolved) == 1
    assert resolved[0].parent_finding.passage == "The I-to-you pivot"
    assert resolved[0].current_finding is None


def test_new_when_no_match_in_parent():
    parent_finding = _make_finding("Old issue")
    parent = _make_run_record("run-1", [parent_finding])

    current_finding = _make_finding("Brand new problem")
    diffs = diff_findings(current_findings=[current_finding], chain=[parent])

    new = [d for d in diffs if d.status == "new"]
    assert len(new) == 1
    assert new[0].current_finding.passage == "Brand new problem"


def test_regressed_from_chain_ancestor():
    f_original = _make_finding("The opening redefinition")
    run_1 = _make_run_record("run-1", [f_original])
    run_2 = _make_run_record("run-2", [], parent_run_id="run-1")

    f_reappeared = _make_finding("The opening redefinition")
    diffs = diff_findings(current_findings=[f_reappeared], chain=[run_1, run_2])

    regressed = [d for d in diffs if d.status == "regressed"]
    assert len(regressed) == 1
    assert regressed[0].current_finding.passage == "The opening redefinition"


def test_run_streak_counts_consecutive():
    f = _make_finding("No headings in the piece")
    run_1 = _make_run_record("run-1", [f])
    run_2 = _make_run_record("run-2", [f], parent_run_id="run-1")
    run_3 = _make_run_record("run-3", [f], parent_run_id="run-2")

    current = [_make_finding("No headings in the piece")]
    diffs = diff_findings(current_findings=current, chain=[run_1, run_2, run_3])

    persists = [d for d in diffs if d.status == "persists"]
    assert len(persists) == 1
    assert persists[0].run_streak == 4


def test_severity_change_de_escalated():
    parent_finding = _make_finding("Issue", severity="high")
    parent = _make_run_record("run-1", [parent_finding])

    current_finding = _make_finding("Issue", severity="medium")
    diffs = diff_findings(current_findings=[current_finding], chain=[parent])

    assert diffs[0].severity_change == "de-escalated"


def test_severity_change_none_when_same():
    parent_finding = _make_finding("Issue", severity="high")
    parent = _make_run_record("run-1", [parent_finding])

    current_finding = _make_finding("Issue", severity="high")
    diffs = diff_findings(current_findings=[current_finding], chain=[parent])

    assert diffs[0].severity_change is None


def test_partial_passage_overlap_matches():
    parent_finding = _make_finding(
        "In my experience building products across three companies and many teams"
    )
    parent = _make_run_record("run-1", [parent_finding])

    current_finding = _make_finding(
        "In my experience building products across three companies"
    )
    diffs = diff_findings(current_findings=[current_finding], chain=[parent])

    persists = [d for d in diffs if d.status == "persists"]
    assert len(persists) == 1
