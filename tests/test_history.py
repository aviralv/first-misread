import json
from pathlib import Path

from first_misread.history import HistoryManager
from first_misread.models import (
    AggregatedFinding,
    ContentMetadata,
    PersonaVerdict,
    RunRecord,
)


def _make_metadata() -> ContentMetadata:
    return ContentMetadata(
        word_count=500,
        estimated_read_time_minutes=2.5,
        paragraph_count=8,
        heading_count=0,
        has_lists=False,
        has_links=True,
        sentence_count=25,
        avg_sentence_length=20.0,
    )


def _make_run_record(
    run_id: str,
    slug: str,
    content_hash: str = "abc",
    parent_run_id: str | None = None,
    findings: list[AggregatedFinding] | None = None,
) -> RunRecord:
    return RunRecord(
        run_id=run_id,
        timestamp="2026-03-26T10:13:13",
        slug=slug,
        content_hash=content_hash,
        word_count=500,
        model="claude-sonnet-4-6",
        personas_run=["The Scanner"],
        parent_run_id=parent_run_id,
        metadata=_make_metadata(),
        findings=findings or [],
        persona_verdicts=[],
    )


def test_init_creates_empty_history(tmp_path):
    manager = HistoryManager(tmp_path)
    assert manager.chains == {}
    assert manager.runs == {}


def test_init_loads_existing_history(tmp_path):
    history_data = {
        "chains": {"test-slug": ["run-1"]},
        "runs": {
            "run-1": {
                "timestamp": "2026-03-26T10:13:13",
                "slug": "test-slug",
                "content_hash": "abc",
                "parent_run_id": None,
            }
        },
    }
    (tmp_path / "history.json").write_text(json.dumps(history_data))
    manager = HistoryManager(tmp_path)
    assert "test-slug" in manager.chains
    assert "run-1" in manager.runs


def test_save_run_creates_chain(tmp_path):
    manager = HistoryManager(tmp_path)
    record = _make_run_record("run-1", "compassion-linkedin")
    manager.save_run(record)

    assert "compassion-linkedin" in manager.chains
    assert manager.chains["compassion-linkedin"] == ["run-1"]
    assert "run-1" in manager.runs

    history_file = tmp_path / "history.json"
    assert history_file.exists()
    data = json.loads(history_file.read_text())
    assert data["chains"]["compassion-linkedin"] == ["run-1"]


def test_save_run_appends_to_chain(tmp_path):
    manager = HistoryManager(tmp_path)
    r1 = _make_run_record("run-1", "compassion-linkedin")
    r2 = _make_run_record(
        "run-2", "compassion-linkedin-v2", parent_run_id="run-1"
    )
    manager.save_run(r1)
    manager.save_run(r2)

    assert manager.chains["compassion-linkedin"] == ["run-1", "run-2"]


def test_resolve_parent_by_slug(tmp_path):
    manager = HistoryManager(tmp_path)
    r1 = _make_run_record("run-1", "compassion-linkedin")
    manager.save_run(r1)

    parent_id = manager.resolve_parent("compassion-linkedin")
    assert parent_id == "run-1"


def test_resolve_parent_by_run_id(tmp_path):
    manager = HistoryManager(tmp_path)
    r1 = _make_run_record("run-1", "compassion-linkedin")
    manager.save_run(r1)

    parent_id = manager.resolve_parent("run-1")
    assert parent_id == "run-1"


def test_resolve_parent_returns_none_for_unknown(tmp_path):
    manager = HistoryManager(tmp_path)
    assert manager.resolve_parent("nonexistent") is None


def test_resolve_parent_returns_latest_in_chain(tmp_path):
    manager = HistoryManager(tmp_path)
    r1 = _make_run_record("run-1", "compassion-linkedin")
    r2 = _make_run_record("run-2", "compassion-linkedin-v2", parent_run_id="run-1")
    manager.save_run(r1)
    manager.save_run(r2)

    parent_id = manager.resolve_parent("compassion-linkedin")
    assert parent_id == "run-2"


def test_load_chain(tmp_path):
    output_dir_1 = tmp_path / "run-1"
    output_dir_1.mkdir()
    r1 = _make_run_record("run-1", "compassion-linkedin")
    (output_dir_1 / "run.json").write_text(r1.model_dump_json(indent=2))

    output_dir_2 = tmp_path / "run-2"
    output_dir_2.mkdir()
    r2 = _make_run_record("run-2", "compassion-linkedin-v2", parent_run_id="run-1")
    (output_dir_2 / "run.json").write_text(r2.model_dump_json(indent=2))

    manager = HistoryManager(tmp_path)
    manager.save_run(r1)
    manager.save_run(r2)

    chain = manager.load_chain("compassion-linkedin")
    assert len(chain) == 2
    assert chain[0].run_id == "run-1"
    assert chain[1].run_id == "run-2"


def test_load_chain_caps_at_5(tmp_path):
    manager = HistoryManager(tmp_path)
    for i in range(7):
        run_id = f"run-{i}"
        output_dir = tmp_path / run_id
        output_dir.mkdir()
        record = _make_run_record(
            run_id, "test-slug",
            parent_run_id=f"run-{i-1}" if i > 0 else None,
        )
        (output_dir / "run.json").write_text(record.model_dump_json(indent=2))
        manager.save_run(record)

    chain = manager.load_chain("test-slug")
    assert len(chain) == 5
    assert chain[0].run_id == "run-2"
    assert chain[-1].run_id == "run-6"


def test_load_input(tmp_path):
    output_dir = tmp_path / "run-1"
    output_dir.mkdir()
    (output_dir / "input.md").write_text("Hello world")

    manager = HistoryManager(tmp_path)
    text = manager.load_input("run-1")
    assert text == "Hello world"


def test_load_input_returns_none_if_missing(tmp_path):
    manager = HistoryManager(tmp_path)
    assert manager.load_input("nonexistent") is None


def test_content_hash():
    from first_misread.history import content_hash
    h1 = content_hash("Hello world")
    h2 = content_hash("Hello world")
    h3 = content_hash("Different text")
    assert h1 == h2
    assert h1 != h3
    assert len(h1) == 64
