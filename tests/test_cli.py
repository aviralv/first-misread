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
