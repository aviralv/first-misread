from pathlib import Path
from first_misread.personas import load_all_personas

PERSONAS_DIR = Path(__file__).parent.parent / "personas"


def test_all_core_personas_load():
    core, _, _ = load_all_personas(PERSONAS_DIR)
    assert len(core) == 8
    names = {p.name for p in core}
    assert "The Skimmer" in names
    assert "The Busy Reader" in names
    assert "The Hook Judge" in names
    assert "The Skeptic" in names
    assert "The Sensitivity Scanner" in names
    assert "The Voice Editor" in names
    assert "The Executor" in names
    assert "The Structural Reader" in names


def test_all_dynamic_personas_load():
    _, dynamic, _ = load_all_personas(PERSONAS_DIR)
    assert len(dynamic) == 12
    names = {p.name for p in dynamic}
    assert "The Literal Reader" in names
    assert "The Visualizer" in names
    assert "The Domain Outsider" in names
    assert "The Emotional Reader" in names
    assert "The Arc Reader" in names
    assert "The Mirror Seeker" in names
    assert "The Scope Cop" in names
    assert "The Contrarian" in names
    assert "The First Principles Thinker" in names
    assert "The Expansionist" in names
    assert "The Outsider" in names
    assert "The Troll" in names
