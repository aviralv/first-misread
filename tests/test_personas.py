import pytest
from pathlib import Path
from first_misread.personas import load_persona, load_all_personas


def test_load_persona_from_yaml(tmp_path):
    yaml_content = """
name: Test Persona
type: core
behavior: |
  Reads everything carefully.
focus:
  - clarity
  - structure
stops_when: |
  Never stops.
"""
    p = tmp_path / "test.yaml"
    p.write_text(yaml_content)
    persona = load_persona(p)
    assert persona.name == "Test Persona"
    assert persona.type == "core"
    assert "clarity" in persona.focus


def test_load_all_personas(tmp_path):
    core_dir = tmp_path / "core"
    core_dir.mkdir()
    dynamic_dir = tmp_path / "dynamic"
    dynamic_dir.mkdir()
    custom_dir = tmp_path / "custom"
    custom_dir.mkdir()

    (core_dir / "one.yaml").write_text(
        "name: One\ntype: core\nbehavior: b\nfocus:\n  - f\nstops_when: s\n"
    )
    (dynamic_dir / "two.yaml").write_text(
        "name: Two\ntype: dynamic\nbehavior: b\nfocus:\n  - f\nstops_when: s\n"
    )

    core, dynamic, custom = load_all_personas(tmp_path)
    assert len(core) == 1
    assert len(dynamic) == 1
    assert len(custom) == 0
    assert core[0].name == "One"


def test_load_persona_invalid_yaml(tmp_path):
    p = tmp_path / "bad.yaml"
    p.write_text("not: valid: yaml: {{{}}")
    with pytest.raises(Exception):
        load_persona(p)


def test_load_persona_missing_fields(tmp_path):
    p = tmp_path / "incomplete.yaml"
    p.write_text("name: Only Name\n")
    with pytest.raises(Exception):
        load_persona(p)
