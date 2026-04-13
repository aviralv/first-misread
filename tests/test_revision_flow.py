# tests/test_revision_flow.py

import json
from pathlib import Path
from unittest.mock import AsyncMock

from first_misread.pipeline import run_pipeline


def _make_persona_response(persona_name: str, findings: list[dict]) -> dict:
    return {
        "persona": persona_name,
        "behavior_executed": f"{persona_name} read the content",
        "time_simulated": "30s",
        "overall_verdict": f"{persona_name} verdict",
        "findings": findings,
    }


def _make_finding_response(passage: str, severity: str = "high") -> dict:
    return {
        "type": "confusion",
        "severity": severity,
        "passage": passage,
        "location": "paragraph 1",
        "what_happened": f"Problem with: {passage[:30]}",
        "what_persona_understood": "misread",
        "what_author_likely_meant": "something else",
    }


async def test_full_revision_flow(tmp_path):
    """Test: run v1, then run v2 with --revision-of, verify diff and interpreter."""
    personas_dir = tmp_path / "personas"
    personas_dir.mkdir()
    (personas_dir / "core").mkdir()
    (personas_dir / "dynamic").mkdir()
    (personas_dir / "custom").mkdir()

    core_persona = personas_dir / "core" / "scanner.yaml"
    core_persona.write_text("""
name: The Scanner
type: core
behavior: Scan the content quickly
focus:
  - structure
stops_when: 30 seconds pass
""")

    output_dir = tmp_path / "output"
    output_dir.mkdir()

    v1_text = " ".join(["word"] * 60) + " The opening line feels unearned."

    mock_client_v1 = AsyncMock()
    mock_client_v1.model = "claude-sonnet-4-6"
    mock_client_v1.call = AsyncMock(side_effect=[
        {"dynamic_personas": []},
        _make_persona_response("The Scanner", [
            _make_finding_response("The opening line feels unearned"),
        ]),
        {"strengths": []},
    ])

    result_v1 = await run_pipeline(
        text=v1_text,
        personas_dir=personas_dir,
        output_dir=output_dir,
        client=mock_client_v1,
        include_rewrites=False,
    )

    assert (result_v1 / "run.json").exists()
    assert (result_v1 / "input.md").exists()
    assert (output_dir / "history.json").exists()

    v1_record = json.loads((result_v1 / "run.json").read_text())
    v1_run_id = v1_record["run_id"]
    v1_slug = v1_record["slug"]

    v2_text = " ".join(["word"] * 60) + " The revised opening is better."

    mock_client_v2 = AsyncMock()
    mock_client_v2.model = "claude-sonnet-4-6"
    mock_client_v2.call = AsyncMock(side_effect=[
        {"dynamic_personas": []},
        _make_persona_response("The Scanner", [
            _make_finding_response("A brand new issue", severity="medium"),
        ]),
        {"strengths": []},
        {
            "what_landed": ["Opening line was fixed"],
            "what_persists": [],
            "what_regressed": [],
            "revision_pattern": "Targeted fix on flagged passage",
            "suggestion": "Check the middle section next",
        },
    ])

    result_v2 = await run_pipeline(
        text=v2_text,
        personas_dir=personas_dir,
        output_dir=output_dir,
        client=mock_client_v2,
        include_rewrites=False,
        revision_of=v1_slug,
    )

    assert (result_v2 / "run.json").exists()
    assert (result_v2 / "revision-notes.md").exists(), (
        "revision-notes.md not written — interpreter likely did not run"
    )

    v2_record = json.loads((result_v2 / "run.json").read_text())
    assert v2_record["parent_run_id"] == v1_run_id

    summary = (result_v2 / "summary.md").read_text()
    assert "Changes from previous run" in summary, (
        f"Changes section missing from summary.md:\n{summary}"
    )

    revision_notes = (result_v2 / "revision-notes.md").read_text()
    assert "Opening line was fixed" in revision_notes

    history = json.loads((output_dir / "history.json").read_text())
    assert len(history["chains"]) == 1, (
        f"Expected 1 chain, got: {list(history['chains'].keys())}"
    )
    chain_key = list(history["chains"].keys())[0]
    assert len(history["chains"][chain_key]) == 2
