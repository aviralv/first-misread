"""CLI entry point for First Misread."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import click

from first_misread.pipeline import run_pipeline

PROJECT_ROOT = Path(__file__).parent.parent.parent
PERSONAS_DIR = PROJECT_ROOT / "personas"
OUTPUT_DIR = PROJECT_ROOT / "output"


@click.command()
@click.argument("input_path", required=False, type=click.Path(exists=True))
@click.option("--text", "-t", help="Paste text directly instead of a file path")
@click.option("--no-rewrites", is_flag=True, help="Skip rewrite suggestions")
def main(input_path: str | None, text: str | None, no_rewrites: bool):
    """Run First Misread analysis on written content."""
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
        )
    )

    # Print L1 summary to terminal
    summary = (result_dir / "summary.md").read_text()
    click.echo(summary)
    click.echo(f"\nFull results: {result_dir}")


if __name__ == "__main__":
    main()
