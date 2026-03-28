import json

import pytest

from first_misread.interpreter import (
    build_interpreter_prompt,
    parse_revision_notes,
    interpret_revision,
    format_chain_summary,
)
from first_misread.models import (
    AggregatedFinding,
    ContentMetadata,
    FindingDiff,
    PersonaVerdict,
    RevisionNotes,
    RunRecord,
)


def _make_metadata() -> ContentMetadata:
    return ContentMetadata(
        word_count=500, estimated_read_time_minutes=2.5,
        paragraph_count=8, heading_count=0, has_lists=False,
        has_links=True, sentence_count=25, avg_sentence_length=20.0,
    )


def _make_finding(passage: str, severity: str = "high") -> AggregatedFinding:
    return AggregatedFinding(
        passage=passage, location="p1", severity=severity,
        personas=["Scanner"],
        descriptions=[{"persona": "Scanner", "what_happened": "flagged"}],
    )


def test_build_interpreter_prompt_includes_diffs():
    diffs = [
        FindingDiff(
            status="persists",
            current_finding=_make_finding("Opening line"),
            parent_finding=_make_finding("Opening line", severity="medium"),
            severity_change="escalated",
            persona_count_change=1,
            run_streak=3,
        ),
        FindingDiff(
            status="resolved",
            current_finding=None,
            parent_finding=_make_finding("Pivot sentence"),
            severity_change=None,
            persona_count_change=None,
            run_streak=0,
        ),
    ]
    text_diff = "--- v1\n+++ v2\n@@ -1,3 +1,3 @@\n-old line\n+new line\n context"

    prompt = build_interpreter_prompt(diffs=diffs, text_diff=text_diff, chain_summary="")
    assert "PERSISTS" in prompt
    assert "RESOLVED" in prompt
    assert "Opening line" in prompt
    assert "Pivot sentence" in prompt
    assert "old line" in prompt
    assert "new line" in prompt


def test_build_interpreter_prompt_includes_chain_summary():
    prompt = build_interpreter_prompt(
        diffs=[],
        text_diff="",
        chain_summary="v1: 5 findings | v2: 3 findings",
    )
    assert "v1: 5 findings" in prompt


def test_format_chain_summary():
    run_1 = RunRecord(
        run_id="run-1", timestamp="2026-03-26T10:13:13",
        slug="test", content_hash="a", word_count=500,
        model="claude-sonnet-4-6", personas_run=["Scanner"],
        parent_run_id=None, metadata=_make_metadata(),
        findings=[_make_finding("Issue A"), _make_finding("Issue B")],
        persona_verdicts=[
            PersonaVerdict(persona="Scanner", verdict="ok", key_issue="none"),
        ],
    )
    summary = format_chain_summary([run_1])
    assert "run-1" in summary
    assert "2 findings" in summary


def test_parse_revision_notes_valid():
    data = {
        "what_landed": ["Fixed the opening"],
        "what_persists": ["No headings"],
        "what_regressed": [],
        "revision_pattern": "Word-level hedges",
        "suggestion": "Add a heading",
    }
    notes = parse_revision_notes(data)
    assert isinstance(notes, RevisionNotes)
    assert notes.revision_pattern == "Word-level hedges"


def test_parse_revision_notes_returns_none_on_bad_data():
    notes = parse_revision_notes({"bad": "data"})
    assert notes is None


class FakeClient:
    def __init__(self, response: dict | None):
        self.response = response
        self.calls = []

    async def call(self, system: str, user: str, max_tokens: int = 4096) -> dict | None:
        self.calls.append({"system": system, "user": user})
        return self.response


async def test_interpret_revision_returns_notes():
    client = FakeClient({
        "what_landed": ["Fixed opening"],
        "what_persists": ["No headings"],
        "what_regressed": [],
        "revision_pattern": "Hedging pattern",
        "suggestion": "Add headings",
    })
    diffs = [
        FindingDiff(
            status="new",
            current_finding=_make_finding("Test"),
            run_streak=0,
        ),
    ]
    notes = await interpret_revision(
        client=client, diffs=diffs, text_diff="", chain=[]
    )
    assert notes is not None
    assert notes.revision_pattern == "Hedging pattern"
    assert len(client.calls) == 1


async def test_interpret_revision_returns_none_on_failure():
    client = FakeClient(None)
    diffs = [FindingDiff(status="new", current_finding=_make_finding("Test"), run_streak=0)]
    notes = await interpret_revision(client=client, diffs=diffs, text_diff="", chain=[])
    assert notes is None
