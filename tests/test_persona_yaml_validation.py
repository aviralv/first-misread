from pathlib import Path
from first_misread.personas import load_all_personas

PERSONAS_DIR = Path(__file__).parent.parent / "personas"


def test_all_core_personas_load():
    core, _, _ = load_all_personas(PERSONAS_DIR)
    assert len(core) == 4
    names = {p.name for p in core}
    assert "The Scanner" in names
    assert "The Skimmer" in names
    assert "The Busy Reader" in names
    assert "The Challenger" in names


def test_all_dynamic_personas_load():
    _, dynamic, _ = load_all_personas(PERSONAS_DIR)
    assert len(dynamic) == 5
    names = {p.name for p in dynamic}
    assert "The Literal Reader" in names
    assert "The Skeptic" in names
