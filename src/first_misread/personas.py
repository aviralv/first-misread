"""Load persona definitions from YAML files."""

from __future__ import annotations

import logging
from pathlib import Path

import yaml

from first_misread.models import PersonaConfig

logger = logging.getLogger(__name__)


def load_persona(path: Path) -> PersonaConfig:
    """Load a single persona from a YAML file."""
    raw = yaml.safe_load(path.read_text())
    return PersonaConfig(**raw)


def load_all_personas(
    personas_dir: Path,
) -> tuple[list[PersonaConfig], list[PersonaConfig], list[PersonaConfig]]:
    """Load all personas from core/, dynamic/, and custom/ directories.

    Returns (core, dynamic, custom) tuple.
    """
    core = _load_dir(personas_dir / "core")
    dynamic = _load_dir(personas_dir / "dynamic")
    custom = _load_dir(personas_dir / "custom")
    return core, dynamic, custom


def _load_dir(directory: Path) -> list[PersonaConfig]:
    """Load all YAML files from a directory, skipping invalid ones."""
    if not directory.exists():
        return []
    personas = []
    for path in sorted(directory.glob("*.yaml")):
        try:
            personas.append(load_persona(path))
        except Exception as e:
            logger.warning(f"Skipping invalid persona {path.name}: {e}")
    return personas
