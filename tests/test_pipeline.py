import pytest
from pathlib import Path
from unittest.mock import AsyncMock
from first_misread.pipeline import run_pipeline, validate_input, make_slug
import json


def test_validate_input_too_short():
    with pytest.raises(ValueError, match="too short"):
        validate_input("Hello world.")


def test_validate_input_too_long():
    text = " ".join(["word"] * 3000)
    with pytest.raises(ValueError, match="too long"):
        validate_input(text)


def test_validate_input_ok():
    text = " ".join(["word"] * 500)
    assert validate_input(text) == text


def test_validate_input_boundary_49_words():
    text = " ".join(["word"] * 49)
    with pytest.raises(ValueError, match="too short"):
        validate_input(text)


def test_validate_input_boundary_50_words():
    text = " ".join(["word"] * 50)
    assert validate_input(text) == text


def test_validate_input_boundary_2500_words():
    text = " ".join(["word"] * 2500)
    assert validate_input(text) == text


def test_validate_input_boundary_2501_words():
    text = " ".join(["word"] * 2501)
    with pytest.raises(ValueError, match="too long"):
        validate_input(text)


def test_make_slug_from_filename():
    assert make_slug(file_path=Path("my-draft-post.md")) == "my-draft-post"


def test_make_slug_from_text():
    slug = make_slug(text="Why Most Product Roadmaps Are Fiction and what to do")
    assert slug == "why-most-product-roadmaps-are"


async def test_pipeline_end_to_end(tmp_path):
    """Integration test with mocked Claude calls."""
    text = " ".join(["word"] * 200) + ". " + " ".join(["sentence"] * 100) + "."

    mock_selector_response = {"dynamic_personas": []}
    mock_persona_response = {
        "persona": "Test",
        "behavior_executed": "Scanned",
        "time_simulated": "10s",
        "overall_verdict": "OK",
        "findings": [],
    }

    async def mock_call(system: str, user: str, **kwargs):
        if "select" in system.lower() or "dynamic_personas" in user.lower():
            return mock_selector_response
        return mock_persona_response

    mock_client = AsyncMock()
    mock_client.call = AsyncMock(side_effect=mock_call)

    personas_dir = tmp_path / "personas"
    for sub in ["core", "dynamic", "custom"]:
        (personas_dir / sub).mkdir(parents=True)
    (personas_dir / "core" / "test.yaml").write_text(
        "name: Test\ntype: core\nbehavior: b\nfocus:\n  - f\nstops_when: s\n"
    )

    output_dir = tmp_path / "output"
    result = await run_pipeline(
        text=text,
        personas_dir=personas_dir,
        output_dir=output_dir,
        client=mock_client,
        include_rewrites=False,
    )

    assert result.exists()
    assert (result / "summary.md").exists()
    assert (result / "persona-details.md").exists()


async def test_pipeline_writes_run_json(tmp_path):
    """Pipeline should write run.json and input.md in output directory."""
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
  - headings
stops_when: 30 seconds pass
""")

    output_dir = tmp_path / "output"
    output_dir.mkdir()

    mock_client = AsyncMock()
    mock_client.model = "claude-sonnet-4-6"
    mock_client.call = AsyncMock(side_effect=[
        {"dynamic_personas": []},
        {
            "persona": "The Scanner",
            "behavior_executed": "Scanned quickly",
            "time_simulated": "30s",
            "overall_verdict": "Looks fine",
            "findings": [],
        },
    ])

    text = "A " * 60

    result_dir = await run_pipeline(
        text=text,
        personas_dir=personas_dir,
        output_dir=output_dir,
        client=mock_client,
        include_rewrites=False,
    )

    assert (result_dir / "run.json").exists()
    assert (result_dir / "input.md").exists()

    run_data = json.loads((result_dir / "run.json").read_text())
    assert run_data["word_count"] == 60
    assert "The Scanner" in run_data["personas_run"]

    assert (result_dir / "input.md").read_text().strip() == text.strip()
