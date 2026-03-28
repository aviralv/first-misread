"""CLI entry point for First Misread."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import click

from first_misread.history import HistoryManager
from first_misread.pipeline import run_pipeline

PROJECT_ROOT = Path(__file__).parent.parent.parent
PERSONAS_DIR = PROJECT_ROOT / "personas"
OUTPUT_DIR = PROJECT_ROOT / "output"


@click.command()
@click.argument("input_path", required=False, type=click.Path(exists=True))
@click.option("--text", "-t", help="Paste text directly instead of a file path")
@click.option("--no-rewrites", is_flag=True, help="Skip rewrite suggestions")
@click.option("--revision-of", "revision_of", default=None, help="Link to a previous run by slug or run ID")
@click.option("--no-history", is_flag=True, help="Skip history tracking entirely")
@click.option("--history", "show_history", default=None, help="Show chain history for a slug")
def main(
    input_path: str | None,
    text: str | None,
    no_rewrites: bool,
    revision_of: str | None,
    no_history: bool,
    show_history: str | None,
):
    """Run First Misread analysis on written content."""
    if show_history:
        history = HistoryManager(OUTPUT_DIR)
        if show_history not in history.chains:
            click.echo(f"No chain found for: {show_history}", err=True)
            sys.exit(1)

        run_ids = history.chains[show_history]
        click.echo(f"Chain: {show_history}")
        click.echo(f"Runs: {len(run_ids)} runs")
        click.echo("")
        for i, run_id in enumerate(run_ids, 1):
            run_info = history.runs.get(run_id, {})
            ts = run_info.get("timestamp", "unknown")
            click.echo(f"  v{i}: {run_id} ({ts})")
        return

    if input_path:
        file_path = Path(input_path)
        content = file_path.read_text()
    elif text:
        file_path = None
        content = text
    elif not sys.stdin.isatty():
        file_path = None
        content = sys.stdin.read()
    else:
        click.echo("Error: Provide a file path, --text, or pipe via stdin", err=True)
        sys.exit(1)

    result_dir = asyncio.run(
        run_pipeline(
            text=content,
            personas_dir=PERSONAS_DIR,
            output_dir=OUTPUT_DIR,
            include_rewrites=not no_rewrites,
            file_path=file_path,
            revision_of=revision_of,
            no_history=no_history,
        )
    )

    summary = (result_dir / "summary.md").read_text()
    click.echo(summary)

    revision_notes_file = result_dir / "revision-notes.md"
    if revision_notes_file.exists():
        click.echo("")
        click.echo(revision_notes_file.read_text())

    click.echo(f"\nFull results: {result_dir}")


if __name__ == "__main__":
    main()
