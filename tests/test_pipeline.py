import pytest
from pathlib import Path
from unittest.mock import AsyncMock
from first_misread.pipeline import run_pipeline, validate_input, make_slug


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
