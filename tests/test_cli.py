import pytest
from pathlib import Path
from unittest.mock import patch, AsyncMock
from click.testing import CliRunner
from first_misread.cli import main


@pytest.fixture
def runner():
    return CliRunner()


@pytest.fixture
def mock_pipeline(tmp_path):
    output_dir = tmp_path / "2026-01-01-000000-test"
    output_dir.mkdir()
    (output_dir / "summary.md").write_text("# First Misread Report\n\nTest summary.")
    (output_dir / "persona-details.md").write_text("# Persona Details\n")
    return output_dir


def test_cli_with_file(runner, tmp_path, mock_pipeline):
    input_file = tmp_path / "post.md"
    input_file.write_text(" ".join(["word"] * 200))
    with patch("first_misread.cli.run_pipeline", new_callable=AsyncMock, return_value=mock_pipeline):
        result = runner.invoke(main, [str(input_file)])
    assert result.exit_code == 0
    assert "First Misread Report" in result.output


def test_cli_with_text_option(runner, mock_pipeline):
    text = " ".join(["word"] * 200)
    with patch("first_misread.cli.run_pipeline", new_callable=AsyncMock, return_value=mock_pipeline):
        result = runner.invoke(main, ["--text", text])
    assert result.exit_code == 0


def test_cli_no_input(runner):
    result = runner.invoke(main, [])
    assert result.exit_code == 1


import json


def test_revision_of_flag():
    runner = CliRunner()
    result = runner.invoke(main, ["--help"])
    assert "--revision-of" in result.output


def test_no_history_flag():
    runner = CliRunner()
    result = runner.invoke(main, ["--help"])
    assert "--no-history" in result.output


def test_history_flag():
    runner = CliRunner()
    result = runner.invoke(main, ["--help"])
    assert "--history" in result.output


def test_history_shows_chain(tmp_path):
    history_data = {
        "chains": {"test-slug": ["run-1", "run-2"]},
        "runs": {
            "run-1": {
                "timestamp": "2026-03-26T10:13:13",
                "slug": "test-slug",
                "content_hash": "abc",
                "parent_run_id": None,
            },
            "run-2": {
                "timestamp": "2026-03-26T11:00:00",
                "slug": "test-slug-v2",
                "content_hash": "def",
                "parent_run_id": "run-1",
            },
        },
    }
    (tmp_path / "history.json").write_text(json.dumps(history_data))

    runner = CliRunner()
    with patch("first_misread.cli.OUTPUT_DIR", tmp_path):
        result = runner.invoke(main, ["--history", "test-slug"])
    assert result.exit_code == 0
    assert "test-slug" in result.output
    assert "2 runs" in result.output
