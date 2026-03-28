# Version History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a history layer to the first-misread pipeline that persists structured run data, diffs findings across versions, and runs a revision interpreter to diagnose revision patterns.

**Architecture:** Three new modules (`history.py`, `differ.py`, `interpreter.py`) slot into the pipeline between aggregation and output. The existing simulation pipeline is untouched — history is post-hoc. Each run writes `run.json` + `input.md` alongside existing markdown. An `output/history.json` index maps version chains.

**Tech Stack:** Python 3.12, Pydantic v2, difflib (SequenceMatcher), hashlib (SHA-256), Click CLI, pytest + pytest-asyncio

---

### Task 1: New Pydantic Models

**Files:**
- Modify: `src/first_misread/models.py`
- Test: `tests/test_models.py`

- [ ] **Step 1: Write failing tests for new models**

```python
# tests/test_models.py — append to existing file

from first_misread.models import (
    PersonaVerdict,
    RunRecord,
    FindingDiff,
    RevisionNotes,
    ContentMetadata,
    AggregatedFinding,
)


def test_persona_verdict_creation():
    v = PersonaVerdict(
        persona="The Scanner",
        verdict="Strong hook but no headings broke momentum",
        key_issue="No visual structure for scanning",
    )
    assert v.persona == "The Scanner"
    assert v.verdict == "Strong hook but no headings broke momentum"
    assert v.key_issue == "No visual structure for scanning"


def test_run_record_creation():
    metadata = ContentMetadata(
        word_count=500,
        estimated_read_time_minutes=2.5,
        paragraph_count=8,
        heading_count=0,
        has_lists=False,
        has_links=True,
        sentence_count=25,
        avg_sentence_length=20.0,
    )
    record = RunRecord(
        run_id="2026-03-26-101313-compassion-linkedin",
        timestamp="2026-03-26T10:13:13",
        slug="compassion-linkedin",
        content_hash="abc123",
        word_count=500,
        model="claude-sonnet-4-6",
        personas_run=["The Scanner", "The Skimmer"],
        parent_run_id=None,
        metadata=metadata,
        findings=[],
        persona_verdicts=[
            PersonaVerdict(persona="The Scanner", verdict="ok", key_issue="none"),
        ],
    )
    assert record.run_id == "2026-03-26-101313-compassion-linkedin"
    assert record.parent_run_id is None
    assert len(record.persona_verdicts) == 1


def test_run_record_with_parent():
    metadata = ContentMetadata(
        word_count=500,
        estimated_read_time_minutes=2.5,
        paragraph_count=8,
        heading_count=0,
        has_lists=False,
        has_links=True,
        sentence_count=25,
        avg_sentence_length=20.0,
    )
    record = RunRecord(
        run_id="2026-03-26-104055-compassion-linkedin-v2",
        timestamp="2026-03-26T10:40:55",
        slug="compassion-linkedin-v2",
        content_hash="def456",
        word_count=490,
        model="claude-sonnet-4-6",
        personas_run=["The Scanner"],
        parent_run_id="2026-03-26-101313-compassion-linkedin",
        metadata=metadata,
        findings=[],
        persona_verdicts=[],
    )
    assert record.parent_run_id == "2026-03-26-101313-compassion-linkedin"


def test_run_record_serialization_roundtrip():
    metadata = ContentMetadata(
        word_count=500,
        estimated_read_time_minutes=2.5,
        paragraph_count=8,
        heading_count=0,
        has_lists=False,
        has_links=True,
        sentence_count=25,
        avg_sentence_length=20.0,
    )
    finding = AggregatedFinding(
        passage="Test passage",
        location="paragraph 1",
        severity="high",
        personas=["The Scanner"],
        descriptions=[{"persona": "The Scanner", "what_happened": "bounced"}],
    )
    record = RunRecord(
        run_id="test-run",
        timestamp="2026-03-26T10:13:13",
        slug="test",
        content_hash="abc",
        word_count=500,
        model="claude-sonnet-4-6",
        personas_run=["The Scanner"],
        parent_run_id=None,
        metadata=metadata,
        findings=[finding],
        persona_verdicts=[],
    )
    json_str = record.model_dump_json(indent=2)
    restored = RunRecord.model_validate_json(json_str)
    assert restored.run_id == record.run_id
    assert restored.findings[0].passage == "Test passage"
    assert restored.findings[0].signal_strength == "flagged by 1 persona"


def test_finding_diff_new():
    finding = AggregatedFinding(
        passage="New issue", location="p1", severity="high",
        personas=["Scanner"],
        descriptions=[{"persona": "Scanner", "what_happened": "problem"}],
    )
    diff = FindingDiff(
        status="new",
        current_finding=finding,
        parent_finding=None,
        severity_change=None,
        persona_count_change=None,
        run_streak=0,
    )
    assert diff.status == "new"
    assert diff.parent_finding is None
    assert diff.run_streak == 0


def test_finding_diff_persists():
    current = AggregatedFinding(
        passage="Same issue", location="p1", severity="high",
        personas=["Scanner", "Skimmer", "Challenger"],
        descriptions=[{"persona": "Scanner", "what_happened": "still bad"}],
    )
    parent = AggregatedFinding(
        passage="Same issue", location="p1", severity="medium",
        personas=["Scanner"],
        descriptions=[{"persona": "Scanner", "what_happened": "bad"}],
    )
    diff = FindingDiff(
        status="persists",
        current_finding=current,
        parent_finding=parent,
        severity_change="escalated",
        persona_count_change=2,
        run_streak=3,
    )
    assert diff.status == "persists"
    assert diff.severity_change == "escalated"
    assert diff.run_streak == 3


def test_finding_diff_resolved():
    parent = AggregatedFinding(
        passage="Fixed issue", location="p2", severity="high",
        personas=["Challenger"],
        descriptions=[{"persona": "Challenger", "what_happened": "unsupported"}],
    )
    diff = FindingDiff(
        status="resolved",
        current_finding=None,
        parent_finding=parent,
        severity_change=None,
        persona_count_change=None,
        run_streak=0,
    )
    assert diff.status == "resolved"
    assert diff.current_finding is None


def test_revision_notes_creation():
    notes = RevisionNotes(
        what_landed=["Fixed the throat-clearing paragraph"],
        what_persists=["No headings — Scanner bounced again"],
        what_regressed=["Opening redefinition escalated from 3 to 5 personas"],
        revision_pattern="Word-level hedges instead of structural changes",
        suggestion="Add one heading before the personal backstory section",
    )
    assert len(notes.what_landed) == 1
    assert "hedges" in notes.revision_pattern
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/I578221/Library/CloudStorage/OneDrive-SAPSE/Documents/the-product-kitchen/Playground/first-misread && uv run pytest tests/test_models.py -v -k "verdict or run_record or finding_diff or revision_notes"`
Expected: FAIL with ImportError (PersonaVerdict, RunRecord, FindingDiff, RevisionNotes not defined)

- [ ] **Step 3: Add new models to models.py**

Add to `src/first_misread/models.py` after the `RewriteSuggestion` class:

```python
class PersonaVerdict(BaseModel):
    """Compact persona verdict for run records."""

    persona: str
    verdict: str
    key_issue: str


class RunRecord(BaseModel):
    """Structured record of a single pipeline run."""

    run_id: str
    timestamp: str
    slug: str
    content_hash: str
    word_count: int
    model: str
    personas_run: list[str]
    parent_run_id: str | None = None
    metadata: ContentMetadata
    findings: list[AggregatedFinding]
    persona_verdicts: list[PersonaVerdict]


class FindingDiff(BaseModel):
    """Comparison of a finding across two runs."""

    status: Literal["resolved", "persists", "new", "regressed"]
    current_finding: AggregatedFinding | None = None
    parent_finding: AggregatedFinding | None = None
    severity_change: str | None = None
    persona_count_change: int | None = None
    run_streak: int = 0


class RevisionNotes(BaseModel):
    """Output of the revision interpreter."""

    what_landed: list[str]
    what_persists: list[str]
    what_regressed: list[str]
    revision_pattern: str
    suggestion: str
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/I578221/Library/CloudStorage/OneDrive-SAPSE/Documents/the-product-kitchen/Playground/first-misread && uv run pytest tests/test_models.py -v -k "verdict or run_record or finding_diff or revision_notes"`
Expected: All 8 new tests PASS

- [ ] **Step 5: Run full test suite to check nothing broke**

Run: `cd /Users/I578221/Library/CloudStorage/OneDrive-SAPSE/Documents/the-product-kitchen/Playground/first-misread && uv run pytest tests/ -v`
Expected: All existing tests still PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/I578221/Library/CloudStorage/OneDrive-SAPSE/Documents/the-product-kitchen/Playground/first-misread
git add src/first_misread/models.py tests/test_models.py
git commit -m "feat(models): add RunRecord, PersonaVerdict, FindingDiff, RevisionNotes"
```

---

### Task 2: History Manager

**Files:**
- Create: `src/first_misread/history.py`
- Test: `tests/test_history.py`

- [ ] **Step 1: Write failing tests for history manager**

```python
# tests/test_history.py

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/I578221/Library/CloudStorage/OneDrive-SAPSE/Documents/the-product-kitchen/Playground/first-misread && uv run pytest tests/test_history.py -v`
Expected: FAIL with ModuleNotFoundError (first_misread.history not found)

- [ ] **Step 3: Implement history manager**

```python
# src/first_misread/history.py
"""History manager — tracks version chains and run records."""

from __future__ import annotations

import hashlib
import json
import logging
from pathlib import Path

from first_misread.models import RunRecord

logger = logging.getLogger(__name__)

MAX_CHAIN_LENGTH = 5


def content_hash(text: str) -> str:
    """SHA-256 hash of input text."""
    return hashlib.sha256(text.encode()).hexdigest()


class HistoryManager:
    """Manages history.json and run record loading."""

    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.history_file = output_dir / "history.json"
        self.chains: dict[str, list[str]] = {}
        self.runs: dict[str, dict] = {}
        self._load()

    def _load(self) -> None:
        """Load history.json if it exists."""
        if self.history_file.exists():
            try:
                data = json.loads(self.history_file.read_text())
                self.chains = data.get("chains", {})
                self.runs = data.get("runs", {})
            except (json.JSONDecodeError, KeyError) as e:
                logger.warning(f"Could not load history.json: {e}")

    def _save(self) -> None:
        """Write history.json to disk."""
        self.output_dir.mkdir(parents=True, exist_ok=True)
        data = {"chains": self.chains, "runs": self.runs}
        self.history_file.write_text(json.dumps(data, indent=2))

    def save_run(self, record: RunRecord) -> None:
        """Register a run in the index and persist."""
        chain_key = self._find_chain_key(record)

        if chain_key not in self.chains:
            self.chains[chain_key] = []
        self.chains[chain_key].append(record.run_id)

        self.runs[record.run_id] = {
            "timestamp": record.timestamp,
            "slug": record.slug,
            "content_hash": record.content_hash,
            "parent_run_id": record.parent_run_id,
        }
        self._save()

    def _find_chain_key(self, record: RunRecord) -> str:
        """Find the chain key for a record.

        If the record has a parent, use the parent's chain.
        Otherwise, use the slug as a new chain key.
        """
        if record.parent_run_id:
            for key, run_ids in self.chains.items():
                if record.parent_run_id in run_ids:
                    return key
        return record.slug

    def resolve_parent(self, ref: str) -> str | None:
        """Resolve a slug or run ID to the latest run ID in that chain.

        Returns None if no match found.
        """
        if ref in self.chains:
            return self.chains[ref][-1]

        for chain_key, run_ids in self.chains.items():
            if ref in run_ids:
                return ref

        return None

    def load_chain(self, chain_ref: str) -> list[RunRecord]:
        """Load full RunRecords for a chain, capped at MAX_CHAIN_LENGTH most recent."""
        chain_key = None
        for key, run_ids in self.chains.items():
            if chain_ref == key or chain_ref in run_ids:
                chain_key = key
                break

        if chain_key is None:
            return []

        run_ids = self.chains[chain_key][-MAX_CHAIN_LENGTH:]
        records = []
        for run_id in run_ids:
            run_dir = self.output_dir / run_id
            run_file = run_dir / "run.json"
            if run_file.exists():
                try:
                    record = RunRecord.model_validate_json(run_file.read_text())
                    records.append(record)
                except Exception as e:
                    logger.warning(f"Could not load run record {run_id}: {e}")
        return records

    def load_input(self, run_id: str) -> str | None:
        """Load the input text for a specific run."""
        input_file = self.output_dir / run_id / "input.md"
        if input_file.exists():
            return input_file.read_text()
        return None
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/I578221/Library/CloudStorage/OneDrive-SAPSE/Documents/the-product-kitchen/Playground/first-misread && uv run pytest tests/test_history.py -v`
Expected: All 13 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/I578221/Library/CloudStorage/OneDrive-SAPSE/Documents/the-product-kitchen/Playground/first-misread
git add src/first_misread/history.py tests/test_history.py
git commit -m "feat(history): add HistoryManager for version chain tracking"
```

---

### Task 3: Finding Differ

**Files:**
- Create: `src/first_misread/differ.py`
- Test: `tests/test_differ.py`

- [ ] **Step 1: Write failing tests for the differ**

```python
# tests/test_differ.py

from first_misread.differ import diff_findings
from first_misread.models import AggregatedFinding, FindingDiff, RunRecord, ContentMetadata, PersonaVerdict


def _make_finding(
    passage: str,
    severity: str = "high",
    personas: list[str] | None = None,
) -> AggregatedFinding:
    personas = personas or ["Scanner"]
    return AggregatedFinding(
        passage=passage,
        location="paragraph 1",
        severity=severity,
        personas=personas,
        descriptions=[
            {"persona": p, "what_happened": f"{p} flagged this"}
            for p in personas
        ],
    )


def _make_metadata() -> ContentMetadata:
    return ContentMetadata(
        word_count=500, estimated_read_time_minutes=2.5,
        paragraph_count=8, heading_count=0, has_lists=False,
        has_links=True, sentence_count=25, avg_sentence_length=20.0,
    )


def _make_run_record(
    run_id: str,
    findings: list[AggregatedFinding],
    parent_run_id: str | None = None,
) -> RunRecord:
    return RunRecord(
        run_id=run_id,
        timestamp="2026-03-26T10:13:13",
        slug="test",
        content_hash="abc",
        word_count=500,
        model="claude-sonnet-4-6",
        personas_run=["Scanner"],
        parent_run_id=parent_run_id,
        metadata=_make_metadata(),
        findings=findings,
        persona_verdicts=[],
    )


def test_all_new_findings_when_no_parent():
    current = [_make_finding("Issue A"), _make_finding("Issue B")]
    diffs = diff_findings(current_findings=current, chain=[])
    assert len(diffs) == 2
    assert all(d.status == "new" for d in diffs)
    assert all(d.run_streak == 0 for d in diffs)


def test_persists_when_same_passage():
    parent_finding = _make_finding("The opening line feels unearned", severity="medium", personas=["Scanner"])
    current_finding = _make_finding("The opening line feels unearned", severity="high", personas=["Scanner", "Challenger"])

    parent = _make_run_record("run-1", [parent_finding])
    diffs = diff_findings(current_findings=[current_finding], chain=[parent])

    assert len(diffs) == 1
    assert diffs[0].status == "persists"
    assert diffs[0].severity_change == "escalated"
    assert diffs[0].persona_count_change == 1
    assert diffs[0].run_streak == 2


def test_resolved_when_parent_finding_gone():
    parent_finding = _make_finding("The I-to-you pivot")
    parent = _make_run_record("run-1", [parent_finding])

    current_finding = _make_finding("Completely different issue")
    diffs = diff_findings(current_findings=[current_finding], chain=[parent])

    resolved = [d for d in diffs if d.status == "resolved"]
    assert len(resolved) == 1
    assert resolved[0].parent_finding.passage == "The I-to-you pivot"
    assert resolved[0].current_finding is None


def test_new_when_no_match_in_parent():
    parent_finding = _make_finding("Old issue")
    parent = _make_run_record("run-1", [parent_finding])

    current_finding = _make_finding("Brand new problem")
    diffs = diff_findings(current_findings=[current_finding], chain=[parent])

    new = [d for d in diffs if d.status == "new"]
    assert len(new) == 1
    assert new[0].current_finding.passage == "Brand new problem"


def test_regressed_from_chain_ancestor():
    f_original = _make_finding("The opening redefinition")
    run_1 = _make_run_record("run-1", [f_original])
    run_2 = _make_run_record("run-2", [], parent_run_id="run-1")

    f_reappeared = _make_finding("The opening redefinition")
    diffs = diff_findings(current_findings=[f_reappeared], chain=[run_1, run_2])

    regressed = [d for d in diffs if d.status == "regressed"]
    assert len(regressed) == 1
    assert regressed[0].current_finding.passage == "The opening redefinition"


def test_run_streak_counts_consecutive():
    f = _make_finding("No headings in the piece")
    run_1 = _make_run_record("run-1", [f])
    run_2 = _make_run_record("run-2", [f], parent_run_id="run-1")
    run_3 = _make_run_record("run-3", [f], parent_run_id="run-2")

    current = [_make_finding("No headings in the piece")]
    diffs = diff_findings(current_findings=current, chain=[run_1, run_2, run_3])

    persists = [d for d in diffs if d.status == "persists"]
    assert len(persists) == 1
    assert persists[0].run_streak == 4


def test_severity_change_de_escalated():
    parent_finding = _make_finding("Issue", severity="high")
    parent = _make_run_record("run-1", [parent_finding])

    current_finding = _make_finding("Issue", severity="medium")
    diffs = diff_findings(current_findings=[current_finding], chain=[parent])

    assert diffs[0].severity_change == "de-escalated"


def test_severity_change_none_when_same():
    parent_finding = _make_finding("Issue", severity="high")
    parent = _make_run_record("run-1", [parent_finding])

    current_finding = _make_finding("Issue", severity="high")
    diffs = diff_findings(current_findings=[current_finding], chain=[parent])

    assert diffs[0].severity_change is None


def test_partial_passage_overlap_matches():
    parent_finding = _make_finding(
        "In my experience building products across three companies and many teams"
    )
    parent = _make_run_record("run-1", [parent_finding])

    current_finding = _make_finding(
        "In my experience building products across three companies"
    )
    diffs = diff_findings(current_findings=[current_finding], chain=[parent])

    persists = [d for d in diffs if d.status == "persists"]
    assert len(persists) == 1
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/I578221/Library/CloudStorage/OneDrive-SAPSE/Documents/the-product-kitchen/Playground/first-misread && uv run pytest tests/test_differ.py -v`
Expected: FAIL with ModuleNotFoundError (first_misread.differ not found)

- [ ] **Step 3: Implement the differ**

```python
# src/first_misread/differ.py
"""Finding differ — compares findings across runs."""

from __future__ import annotations

from difflib import SequenceMatcher

from first_misread.models import AggregatedFinding, FindingDiff, RunRecord

OVERLAP_THRESHOLD = 0.6

SEVERITY_ORDER = {"high": 0, "medium": 1, "low": 2}


def _passages_match(a: str, b: str) -> bool:
    """Check if two passages match above threshold."""
    return SequenceMatcher(None, a.lower(), b.lower()).ratio() >= OVERLAP_THRESHOLD


def _find_match(
    finding: AggregatedFinding,
    candidates: list[AggregatedFinding],
) -> AggregatedFinding | None:
    """Find a matching finding in the candidate list."""
    for candidate in candidates:
        if _passages_match(finding.passage, candidate.passage):
            return candidate
    return None


def _compute_severity_change(
    current: str,
    parent: str,
) -> str | None:
    """Compute severity change direction."""
    c = SEVERITY_ORDER.get(current, 99)
    p = SEVERITY_ORDER.get(parent, 99)
    if c < p:
        return "escalated"
    elif c > p:
        return "de-escalated"
    return None


def _compute_run_streak(
    finding: AggregatedFinding,
    chain: list[RunRecord],
) -> int:
    """Count consecutive runs (from most recent backward) that flagged this passage."""
    streak = 0
    for record in reversed(chain):
        matched = _find_match(finding, record.findings)
        if matched:
            streak += 1
        else:
            break
    return streak + 1  # +1 for the current run


def _was_previously_resolved(
    finding: AggregatedFinding,
    chain: list[RunRecord],
) -> bool:
    """Check if this finding was resolved in a previous run but appeared in an ancestor."""
    if len(chain) < 2:
        return False

    parent = chain[-1]
    parent_match = _find_match(finding, parent.findings)
    if parent_match:
        return False

    for record in chain[:-1]:
        if _find_match(finding, record.findings):
            return True
    return False


def diff_findings(
    current_findings: list[AggregatedFinding],
    chain: list[RunRecord],
) -> list[FindingDiff]:
    """Diff current findings against the chain history.

    Returns a list of FindingDiff with status:
    - new: not seen in any prior run
    - persists: matches a finding in the immediate parent
    - resolved: was in the parent but not in current
    - regressed: was resolved (absent in parent) but reappears from an ancestor
    """
    if not chain:
        return [
            FindingDiff(
                status="new",
                current_finding=f,
                parent_finding=None,
                severity_change=None,
                persona_count_change=None,
                run_streak=0,
            )
            for f in current_findings
        ]

    parent = chain[-1]
    diffs: list[FindingDiff] = []
    matched_parent_indices: set[int] = set()

    for current in current_findings:
        parent_match = None
        for i, pf in enumerate(parent.findings):
            if i not in matched_parent_indices and _passages_match(current.passage, pf.passage):
                parent_match = pf
                matched_parent_indices.add(i)
                break

        if parent_match:
            diffs.append(FindingDiff(
                status="persists",
                current_finding=current,
                parent_finding=parent_match,
                severity_change=_compute_severity_change(current.severity, parent_match.severity),
                persona_count_change=len(current.personas) - len(parent_match.personas),
                run_streak=_compute_run_streak(current, chain),
            ))
        elif _was_previously_resolved(current, chain):
            diffs.append(FindingDiff(
                status="regressed",
                current_finding=current,
                parent_finding=None,
                severity_change=None,
                persona_count_change=None,
                run_streak=0,
            ))
        else:
            diffs.append(FindingDiff(
                status="new",
                current_finding=current,
                parent_finding=None,
                severity_change=None,
                persona_count_change=None,
                run_streak=0,
            ))

    for i, pf in enumerate(parent.findings):
        if i not in matched_parent_indices:
            diffs.append(FindingDiff(
                status="resolved",
                current_finding=None,
                parent_finding=pf,
                severity_change=None,
                persona_count_change=None,
                run_streak=0,
            ))

    return diffs
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/I578221/Library/CloudStorage/OneDrive-SAPSE/Documents/the-product-kitchen/Playground/first-misread && uv run pytest tests/test_differ.py -v`
Expected: All 9 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/I578221/Library/CloudStorage/OneDrive-SAPSE/Documents/the-product-kitchen/Playground/first-misread
git add src/first_misread/differ.py tests/test_differ.py
git commit -m "feat(differ): add finding differ for cross-run comparison"
```

---

### Task 4: Revision Interpreter

**Files:**
- Create: `src/first_misread/interpreter.py`
- Test: `tests/test_interpreter.py`

- [ ] **Step 1: Write failing tests for the interpreter**

```python
# tests/test_interpreter.py

import json

import pytest

from first_misread.interpreter import (
    build_interpreter_prompt,
    parse_revision_notes,
    interpret_revision,
    format_chain_summary,
)
from first_misread.models import (
    AggregatedFinding,
    ContentMetadata,
    FindingDiff,
    PersonaVerdict,
    RevisionNotes,
    RunRecord,
)


def _make_metadata() -> ContentMetadata:
    return ContentMetadata(
        word_count=500, estimated_read_time_minutes=2.5,
        paragraph_count=8, heading_count=0, has_lists=False,
        has_links=True, sentence_count=25, avg_sentence_length=20.0,
    )


def _make_finding(passage: str, severity: str = "high") -> AggregatedFinding:
    return AggregatedFinding(
        passage=passage, location="p1", severity=severity,
        personas=["Scanner"],
        descriptions=[{"persona": "Scanner", "what_happened": "flagged"}],
    )


def test_build_interpreter_prompt_includes_diffs():
    diffs = [
        FindingDiff(
            status="persists",
            current_finding=_make_finding("Opening line"),
            parent_finding=_make_finding("Opening line", severity="medium"),
            severity_change="escalated",
            persona_count_change=1,
            run_streak=3,
        ),
        FindingDiff(
            status="resolved",
            current_finding=None,
            parent_finding=_make_finding("Pivot sentence"),
            severity_change=None,
            persona_count_change=None,
            run_streak=0,
        ),
    ]
    text_diff = "--- v1\n+++ v2\n@@ -1,3 +1,3 @@\n-old line\n+new line\n context"

    prompt = build_interpreter_prompt(diffs=diffs, text_diff=text_diff, chain_summary="")
    assert "PERSISTS" in prompt
    assert "RESOLVED" in prompt
    assert "Opening line" in prompt
    assert "Pivot sentence" in prompt
    assert "old line" in prompt
    assert "new line" in prompt


def test_build_interpreter_prompt_includes_chain_summary():
    prompt = build_interpreter_prompt(
        diffs=[],
        text_diff="",
        chain_summary="v1: 5 findings | v2: 3 findings",
    )
    assert "v1: 5 findings" in prompt


def test_format_chain_summary():
    run_1 = RunRecord(
        run_id="run-1", timestamp="2026-03-26T10:13:13",
        slug="test", content_hash="a", word_count=500,
        model="claude-sonnet-4-6", personas_run=["Scanner"],
        parent_run_id=None, metadata=_make_metadata(),
        findings=[_make_finding("Issue A"), _make_finding("Issue B")],
        persona_verdicts=[
            PersonaVerdict(persona="Scanner", verdict="ok", key_issue="none"),
        ],
    )
    summary = format_chain_summary([run_1])
    assert "run-1" in summary
    assert "2 findings" in summary


def test_parse_revision_notes_valid():
    data = {
        "what_landed": ["Fixed the opening"],
        "what_persists": ["No headings"],
        "what_regressed": [],
        "revision_pattern": "Word-level hedges",
        "suggestion": "Add a heading",
    }
    notes = parse_revision_notes(data)
    assert isinstance(notes, RevisionNotes)
    assert notes.revision_pattern == "Word-level hedges"


def test_parse_revision_notes_returns_none_on_bad_data():
    notes = parse_revision_notes({"bad": "data"})
    assert notes is None


class FakeClient:
    def __init__(self, response: dict | None):
        self.response = response
        self.calls = []

    async def call(self, system: str, user: str, max_tokens: int = 4096) -> dict | None:
        self.calls.append({"system": system, "user": user})
        return self.response


async def test_interpret_revision_returns_notes():
    client = FakeClient({
        "what_landed": ["Fixed opening"],
        "what_persists": ["No headings"],
        "what_regressed": [],
        "revision_pattern": "Hedging pattern",
        "suggestion": "Add headings",
    })
    diffs = [
        FindingDiff(
            status="new",
            current_finding=_make_finding("Test"),
            run_streak=0,
        ),
    ]
    notes = await interpret_revision(
        client=client, diffs=diffs, text_diff="", chain=[]
    )
    assert notes is not None
    assert notes.revision_pattern == "Hedging pattern"
    assert len(client.calls) == 1


async def test_interpret_revision_returns_none_on_failure():
    client = FakeClient(None)
    diffs = [FindingDiff(status="new", current_finding=_make_finding("Test"), run_streak=0)]
    notes = await interpret_revision(client=client, diffs=diffs, text_diff="", chain=[])
    assert notes is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/I578221/Library/CloudStorage/OneDrive-SAPSE/Documents/the-product-kitchen/Playground/first-misread && uv run pytest tests/test_interpreter.py -v`
Expected: FAIL with ModuleNotFoundError

- [ ] **Step 3: Implement the interpreter**

```python
# src/first_misread/interpreter.py
"""Revision interpreter — synthesizes across run history."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from first_misread.models import FindingDiff, RevisionNotes, RunRecord

if TYPE_CHECKING:
    from first_misread.claude_client import ClaudeClient

logger = logging.getLogger(__name__)

INTERPRETER_SYSTEM_PROMPT = """You are an editorial advisor reviewing successive drafts of the same piece. You have the full history of reader-simulation feedback across all versions. Your job is to tell the author what their revision pattern reveals — not to repeat what the personas already said, but to synthesize across runs.

Return your analysis as JSON with this exact structure:
{
  "what_landed": ["list of fixes that worked and why"],
  "what_persists": ["issues that remain, with pattern diagnosis"],
  "what_regressed": ["things that got worse"],
  "revision_pattern": "one-paragraph meta-observation about how the author revises",
  "suggestion": "one concrete next-move recommendation"
}

Be direct. Be specific. Reference actual passages and persona names. Don't repeat what the finding diffs already say — interpret them."""


def format_chain_summary(chain: list[RunRecord]) -> str:
    """Format the chain history into a concise summary."""
    lines = []
    for i, record in enumerate(chain):
        version = f"v{i + 1}"
        finding_count = len(record.findings)
        top_findings = "; ".join(
            f.passage[:60] for f in record.findings[:3]
        )
        lines.append(
            f"- {record.run_id} ({version}): {finding_count} findings. "
            f"Top: {top_findings or 'none'}"
        )
    return "\n".join(lines)


def build_interpreter_prompt(
    diffs: list[FindingDiff],
    text_diff: str,
    chain_summary: str,
) -> str:
    """Build the user prompt for the interpreter call."""
    sections = []

    if chain_summary:
        sections.append(f"## Chain History\n\n{chain_summary}")

    diff_lines = []
    for d in diffs:
        status = d.status.upper()
        if d.current_finding:
            passage = d.current_finding.passage[:100]
        elif d.parent_finding:
            passage = d.parent_finding.passage[:100]
        else:
            passage = "(unknown)"

        line = f"- [{status}] \"{passage}\""
        if d.severity_change:
            line += f" (severity {d.severity_change})"
        if d.persona_count_change and d.persona_count_change != 0:
            sign = "+" if d.persona_count_change > 0 else ""
            line += f" ({sign}{d.persona_count_change} personas)"
        if d.run_streak > 1:
            line += f" (streak: {d.run_streak} consecutive runs)"
        diff_lines.append(line)

    sections.append(f"## Finding Diffs\n\n" + "\n".join(diff_lines))

    if text_diff:
        sections.append(f"## Content Diff\n\n```diff\n{text_diff}\n```")

    return "\n\n".join(sections)


def parse_revision_notes(data: dict) -> RevisionNotes | None:
    """Parse the interpreter response into RevisionNotes."""
    try:
        return RevisionNotes(**data)
    except Exception as e:
        logger.warning(f"Could not parse revision notes: {e}")
        return None


async def interpret_revision(
    client: "ClaudeClient",
    diffs: list[FindingDiff],
    text_diff: str,
    chain: list[RunRecord],
) -> RevisionNotes | None:
    """Run the revision interpreter Claude call."""
    chain_summary = format_chain_summary(chain) if chain else ""

    user_prompt = build_interpreter_prompt(
        diffs=diffs,
        text_diff=text_diff,
        chain_summary=chain_summary,
    )

    result = await client.call(
        system=INTERPRETER_SYSTEM_PROMPT,
        user=user_prompt,
    )

    if result is None:
        return None

    return parse_revision_notes(result)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/I578221/Library/CloudStorage/OneDrive-SAPSE/Documents/the-product-kitchen/Playground/first-misread && uv run pytest tests/test_interpreter.py -v`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/I578221/Library/CloudStorage/OneDrive-SAPSE/Documents/the-product-kitchen/Playground/first-misread
git add src/first_misread/interpreter.py tests/test_interpreter.py
git commit -m "feat(interpreter): add revision interpreter for cross-run synthesis"
```

---

### Task 5: Extend Output Module

**Files:**
- Modify: `src/first_misread/output.py`
- Test: `tests/test_output.py`

- [ ] **Step 1: Write failing tests for new output functions**

```python
# tests/test_output.py — append to existing file

import json
from pathlib import Path

from first_misread.models import (
    AggregatedFinding,
    ContentMetadata,
    FindingDiff,
    PersonaResult,
    PersonaVerdict,
    RevisionNotes,
    RunRecord,
)
from first_misread.output import (
    generate_changes_section,
    generate_revision_notes_md,
    write_run_record,
    write_output,
)


def _make_metadata() -> ContentMetadata:
    return ContentMetadata(
        word_count=500, estimated_read_time_minutes=2.5,
        paragraph_count=8, heading_count=0, has_lists=False,
        has_links=True, sentence_count=25, avg_sentence_length=20.0,
    )


def _make_finding(passage: str, severity: str = "high") -> AggregatedFinding:
    return AggregatedFinding(
        passage=passage, location="p1", severity=severity,
        personas=["Scanner"],
        descriptions=[{"persona": "Scanner", "what_happened": "flagged"}],
    )


def test_generate_changes_section():
    diffs = [
        FindingDiff(
            status="resolved",
            parent_finding=_make_finding("I-to-you pivot"),
            run_streak=0,
        ),
        FindingDiff(
            status="new",
            current_finding=_make_finding("CTA line"),
            run_streak=0,
        ),
        FindingDiff(
            status="persists",
            current_finding=_make_finding("Opening redefinition"),
            parent_finding=_make_finding("Opening redefinition", severity="medium"),
            severity_change="escalated",
            persona_count_change=2,
            run_streak=3,
        ),
    ]
    section = generate_changes_section(diffs, version_label="v2 → v3")
    assert "RESOLVED" in section
    assert "NEW" in section
    assert "PERSISTS" in section
    assert "I-to-you pivot" in section
    assert "3 runs" in section
    assert "v2 → v3" in section


def test_generate_revision_notes_md():
    notes = RevisionNotes(
        what_landed=["Fixed the throat-clearing"],
        what_persists=["No headings"],
        what_regressed=["Opening got worse"],
        revision_pattern="Word-level hedges instead of structural changes",
        suggestion="Add one heading before backstory",
    )
    md = generate_revision_notes_md(notes)
    assert "# Revision Notes" in md
    assert "Fixed the throat-clearing" in md
    assert "Word-level hedges" in md
    assert "Add one heading" in md


def test_write_run_record(tmp_path):
    record = RunRecord(
        run_id="test-run",
        timestamp="2026-03-26T10:13:13",
        slug="test",
        content_hash="abc",
        word_count=500,
        model="claude-sonnet-4-6",
        personas_run=["Scanner"],
        parent_run_id=None,
        metadata=_make_metadata(),
        findings=[_make_finding("Test issue")],
        persona_verdicts=[
            PersonaVerdict(persona="Scanner", verdict="ok", key_issue="none"),
        ],
    )
    write_run_record(tmp_path, record, input_text="Hello world")

    run_json = tmp_path / "run.json"
    assert run_json.exists()
    data = json.loads(run_json.read_text())
    assert data["run_id"] == "test-run"
    assert data["findings"][0]["passage"] == "Test issue"

    input_md = tmp_path / "input.md"
    assert input_md.exists()
    assert input_md.read_text() == "Hello world"


def test_write_output_includes_run_record(tmp_path):
    metadata = _make_metadata()
    results = [
        PersonaResult(
            persona="Scanner", behavior_executed="scanned",
            time_simulated="30s", overall_verdict="ok", findings=[],
        )
    ]
    aggregated = [_make_finding("Test")]

    result_dir = write_output(
        base_dir=tmp_path,
        slug="test",
        title="Test",
        metadata=metadata,
        results=results,
        aggregated=aggregated,
        rewrites=None,
        total_personas=1,
        input_text="Hello world",
        model="claude-sonnet-4-6",
    )

    assert (result_dir / "run.json").exists()
    assert (result_dir / "input.md").exists()
    assert (result_dir / "summary.md").exists()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/I578221/Library/CloudStorage/OneDrive-SAPSE/Documents/the-product-kitchen/Playground/first-misread && uv run pytest tests/test_output.py -v -k "changes_section or revision_notes_md or run_record or includes_run_record"`
Expected: FAIL with ImportError (new functions not defined)

- [ ] **Step 3: Add new functions to output.py**

Add these functions to `src/first_misread/output.py` and update `write_output`:

```python
# Add to imports at top of output.py
from first_misread.models import (
    AggregatedFinding,
    ContentMetadata,
    FindingDiff,
    PersonaResult,
    PersonaVerdict,
    RevisionNotes,
    RewriteSuggestion,
    RunRecord,
)
import json
from first_misread.history import content_hash

# Add these new functions before write_output:

STATUS_EMOJI = {
    "resolved": "\u2705",
    "new": "\U0001f534",
    "persists": "\u26a0\ufe0f",
    "regressed": "\U0001f534",
}


def generate_changes_section(
    diffs: list[FindingDiff],
    version_label: str,
) -> str:
    """Generate the 'Changes from previous run' markdown section."""
    lines = [
        f"## Changes from previous run ({version_label})",
        "",
    ]
    for d in diffs:
        emoji = STATUS_EMOJI.get(d.status, "")
        status = d.status.upper()

        if d.current_finding:
            passage = d.current_finding.passage[:80]
        elif d.parent_finding:
            passage = d.parent_finding.passage[:80]
        else:
            continue

        line = f"- {emoji} {status}: \"{passage}\""

        extras = []
        if d.run_streak > 1:
            extras.append(f"{d.run_streak} runs")
        if d.severity_change:
            extras.append(d.severity_change)
        if d.persona_count_change and d.persona_count_change != 0:
            sign = "+" if d.persona_count_change > 0 else ""
            extras.append(f"{sign}{d.persona_count_change} personas")

        if extras:
            line += f" ({', '.join(extras)})"

        lines.append(line)

    lines.append("")
    return "\n".join(lines)


def generate_revision_notes_md(notes: RevisionNotes) -> str:
    """Generate revision-notes.md markdown."""
    lines = ["# Revision Notes", ""]

    if notes.what_landed:
        lines.append("## What Landed")
        for item in notes.what_landed:
            lines.append(f"- {item}")
        lines.append("")

    if notes.what_persists:
        lines.append("## What Persists")
        for item in notes.what_persists:
            lines.append(f"- {item}")
        lines.append("")

    if notes.what_regressed:
        lines.append("## What Regressed")
        for item in notes.what_regressed:
            lines.append(f"- {item}")
        lines.append("")

    lines.append("## Revision Pattern")
    lines.append(notes.revision_pattern)
    lines.append("")

    lines.append("## Suggestion")
    lines.append(notes.suggestion)
    lines.append("")

    return "\n".join(lines)


def write_run_record(
    output_dir: Path,
    record: RunRecord,
    input_text: str,
) -> None:
    """Write run.json and input.md to the output directory."""
    (output_dir / "run.json").write_text(record.model_dump_json(indent=2))
    (output_dir / "input.md").write_text(input_text)
```

Then update the `write_output` function signature and body to accept and write the new data:

```python
def write_output(
    base_dir: Path,
    slug: str,
    title: str,
    metadata: ContentMetadata,
    results: list[PersonaResult],
    aggregated: list[AggregatedFinding],
    rewrites: list[RewriteSuggestion] | None,
    total_personas: int,
    input_text: str = "",
    model: str = "",
    parent_run_id: str | None = None,
    diffs: list[FindingDiff] | None = None,
    revision_notes: RevisionNotes | None = None,
    version_label: str = "",
) -> Path:
    """Write all output files and return the output directory."""
    timestamp = datetime.now().strftime("%Y-%m-%d-%H%M%S")
    output_dir = base_dir / f"{timestamp}-{slug}"
    output_dir.mkdir(parents=True, exist_ok=True)

    summary = generate_summary(title, metadata, results, aggregated, total_personas)

    if diffs and version_label:
        changes = generate_changes_section(diffs, version_label)
        summary = changes + "\n" + summary

    (output_dir / "summary.md").write_text(summary)

    details = generate_persona_details(results)
    (output_dir / "persona-details.md").write_text(details)

    if rewrites:
        rewrites_md = generate_rewrites_md(rewrites)
        (output_dir / "rewrites.md").write_text(rewrites_md)

    if revision_notes:
        revision_md = generate_revision_notes_md(revision_notes)
        (output_dir / "revision-notes.md").write_text(revision_md)

    run_id = f"{timestamp}-{slug}"
    verdicts = [
        PersonaVerdict(
            persona=r.persona,
            verdict=r.overall_verdict,
            key_issue=r.findings[0].what_happened if r.findings else "No issues",
        )
        for r in results
    ]
    record = RunRecord(
        run_id=run_id,
        timestamp=datetime.now().isoformat(),
        slug=slug,
        content_hash=content_hash(input_text) if input_text else "",
        word_count=metadata.word_count,
        model=model,
        personas_run=[r.persona for r in results],
        parent_run_id=parent_run_id,
        metadata=metadata,
        findings=aggregated,
        persona_verdicts=verdicts,
    )
    write_run_record(output_dir, record, input_text)

    return result_dir
```

**Important:** The final line has a bug — `result_dir` should be `output_dir`. This matches the existing code's variable name. Make sure it reads `return output_dir`.

- [ ] **Step 4: Run the new tests to verify they pass**

Run: `cd /Users/I578221/Library/CloudStorage/OneDrive-SAPSE/Documents/the-product-kitchen/Playground/first-misread && uv run pytest tests/test_output.py -v -k "changes_section or revision_notes_md or run_record or includes_run_record"`
Expected: All 4 new tests PASS

- [ ] **Step 5: Run full test suite to check existing tests still pass**

Run: `cd /Users/I578221/Library/CloudStorage/OneDrive-SAPSE/Documents/the-product-kitchen/Playground/first-misread && uv run pytest tests/test_output.py -v`
Expected: All tests PASS. Note: existing tests that call `write_output` may need the new `input_text` and `model` kwargs added. If they fail, update the existing test calls to pass `input_text=""` and `model=""` (both have defaults, so they should be fine).

- [ ] **Step 6: Commit**

```bash
cd /Users/I578221/Library/CloudStorage/OneDrive-SAPSE/Documents/the-product-kitchen/Playground/first-misread
git add src/first_misread/output.py tests/test_output.py
git commit -m "feat(output): write run.json, input.md, changes section, revision notes"
```

---

### Task 6: Wire Pipeline

**Files:**
- Modify: `src/first_misread/pipeline.py`
- Test: `tests/test_pipeline.py`

- [ ] **Step 1: Write failing test for pipeline history integration**

```python
# tests/test_pipeline.py — append to existing file

import json
from pathlib import Path
from unittest.mock import AsyncMock

from first_misread.pipeline import run_pipeline


async def test_pipeline_writes_run_json(tmp_path):
    """Pipeline should write run.json and input.md in output directory."""
    personas_dir = tmp_path / "personas"
    personas_dir.mkdir()
    (personas_dir / "core").mkdir()
    (personas_dir / "dynamic").mkdir()
    (personas_dir / "custom").mkdir()

    core_persona = personas_dir / "core" / "scanner.yaml"
    core_persona.write_text("""
name: The Scanner
type: core
behavior: Scan the content quickly
focus:
  - structure
  - headings
stops_when: 30 seconds pass
""")

    output_dir = tmp_path / "output"
    output_dir.mkdir()

    mock_client = AsyncMock()
    mock_client.model = "claude-sonnet-4-6"
    mock_client.call = AsyncMock(side_effect=[
        {"dynamic_personas": []},
        {
            "persona": "The Scanner",
            "behavior_executed": "Scanned quickly",
            "time_simulated": "30s",
            "overall_verdict": "Looks fine",
            "findings": [],
        },
    ])

    text = "A " * 60

    result_dir = await run_pipeline(
        text=text,
        personas_dir=personas_dir,
        output_dir=output_dir,
        client=mock_client,
        include_rewrites=False,
    )

    assert (result_dir / "run.json").exists()
    assert (result_dir / "input.md").exists()

    run_data = json.loads((result_dir / "run.json").read_text())
    assert run_data["word_count"] == 60
    assert "The Scanner" in run_data["personas_run"]

    assert (result_dir / "input.md").read_text().strip() == text.strip()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/I578221/Library/CloudStorage/OneDrive-SAPSE/Documents/the-product-kitchen/Playground/first-misread && uv run pytest tests/test_pipeline.py::test_pipeline_writes_run_json -v`
Expected: FAIL (run.json not written — pipeline doesn't produce it yet)

- [ ] **Step 3: Update pipeline.py to wire history**

Update `src/first_misread/pipeline.py`:

```python
"""Main pipeline orchestrator — runs all stages."""

from __future__ import annotations

import difflib
import re
from pathlib import Path

from first_misread.analyzer import analyze_content
from first_misread.aggregator import aggregate_findings
from first_misread.claude_client import ClaudeClient
from first_misread.differ import diff_findings
from first_misread.history import HistoryManager, content_hash
from first_misread.interpreter import interpret_revision
from first_misread.output import write_output
from first_misread.personas import load_all_personas
from first_misread.rewriter import generate_rewrites
from first_misread.selector import select_dynamic_personas
from first_misread.simulator import simulate_all

MIN_WORDS = 50
MAX_WORDS = 2500


def validate_input(text: str) -> str:
    """Validate input text is within bounds."""
    text = text.strip()
    word_count = len(text.split())
    if word_count < MIN_WORDS:
        raise ValueError(f"Input too short: {word_count} words (minimum {MIN_WORDS})")
    if word_count > MAX_WORDS:
        raise ValueError(f"Input too long: {word_count} words (maximum {MAX_WORDS})")
    return text


def make_slug(
    file_path: Path | None = None,
    text: str | None = None,
) -> str:
    """Generate a slug for the output directory."""
    if file_path:
        return file_path.stem
    if text:
        words = re.sub(r"[^\w\s]", "", text).lower().split()[:5]
        return "-".join(words)
    return "untitled"


async def run_pipeline(
    text: str,
    personas_dir: Path,
    output_dir: Path,
    client: ClaudeClient | None = None,
    include_rewrites: bool = True,
    file_path: Path | None = None,
    revision_of: str | None = None,
    no_history: bool = False,
) -> Path:
    """Run the full First Misread pipeline."""
    client = client or ClaudeClient()

    text = validate_input(text)
    slug = make_slug(file_path=file_path, text=text)
    title = (
        file_path.stem.replace("-", " ").replace("_", " ").capitalize()
        if file_path
        else slug.replace("-", " ").capitalize()
    )

    metadata = analyze_content(text)

    core, dynamic, custom = load_all_personas(personas_dir)
    selected_dynamic = await select_dynamic_personas(
        client=client,
        text=text,
        metadata=metadata,
        available_dynamic=dynamic,
    )

    all_personas = core + custom + selected_dynamic

    results = await simulate_all(
        client=client,
        personas=all_personas,
        text=text,
        metadata=metadata,
    )

    aggregated = aggregate_findings(results)

    rewrites = None
    if include_rewrites and aggregated:
        rewrites = await generate_rewrites(
            client=client,
            text=text,
            findings=aggregated,
        )

    diffs = None
    revision_notes = None
    parent_run_id = None
    version_label = ""

    if not no_history:
        history = HistoryManager(output_dir)

        if revision_of:
            parent_run_id = history.resolve_parent(revision_of)

        if parent_run_id:
            chain = history.load_chain(revision_of or parent_run_id)

            diffs = diff_findings(
                current_findings=aggregated,
                chain=chain,
            )

            parent_input = history.load_input(parent_run_id)
            text_diff = ""
            if parent_input:
                diff_lines = difflib.unified_diff(
                    parent_input.splitlines(),
                    text.splitlines(),
                    fromfile="previous",
                    tofile="current",
                    lineterm="",
                )
                text_diff = "\n".join(diff_lines)

            chain_length = len(chain)
            version_label = f"v{chain_length} → v{chain_length + 1}"

            revision_notes = await interpret_revision(
                client=client,
                diffs=diffs,
                text_diff=text_diff,
                chain=chain,
            )

    result_dir = write_output(
        base_dir=output_dir,
        slug=slug,
        title=title,
        metadata=metadata,
        results=results,
        aggregated=aggregated,
        rewrites=rewrites,
        total_personas=len(all_personas),
        input_text=text,
        model=getattr(client, "model", ""),
        parent_run_id=parent_run_id,
        diffs=diffs,
        revision_notes=revision_notes,
        version_label=version_label,
    )

    if not no_history:
        history = HistoryManager(output_dir)
        run_json = result_dir / "run.json"
        if run_json.exists():
            from first_misread.models import RunRecord
            record = RunRecord.model_validate_json(run_json.read_text())
            history.save_run(record)

    return result_dir
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /Users/I578221/Library/CloudStorage/OneDrive-SAPSE/Documents/the-product-kitchen/Playground/first-misread && uv run pytest tests/test_pipeline.py::test_pipeline_writes_run_json -v`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `cd /Users/I578221/Library/CloudStorage/OneDrive-SAPSE/Documents/the-product-kitchen/Playground/first-misread && uv run pytest tests/ -v`
Expected: All tests PASS. If existing pipeline tests fail because `write_output` signature changed, fix them by ensuring default values handle the new kwargs.

- [ ] **Step 6: Commit**

```bash
cd /Users/I578221/Library/CloudStorage/OneDrive-SAPSE/Documents/the-product-kitchen/Playground/first-misread
git add src/first_misread/pipeline.py tests/test_pipeline.py
git commit -m "feat(pipeline): wire history, differ, and interpreter into pipeline"
```

---

### Task 7: CLI Options

**Files:**
- Modify: `src/first_misread/cli.py`
- Test: `tests/test_cli.py`

- [ ] **Step 1: Write failing tests for new CLI options**

```python
# tests/test_cli.py — append to existing file

import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

from click.testing import CliRunner

from first_misread.cli import main


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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/I578221/Library/CloudStorage/OneDrive-SAPSE/Documents/the-product-kitchen/Playground/first-misread && uv run pytest tests/test_cli.py -v -k "revision_of or no_history or history"`
Expected: FAIL (flags not defined yet)

- [ ] **Step 3: Update CLI with new options**

```python
# src/first_misread/cli.py
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/I578221/Library/CloudStorage/OneDrive-SAPSE/Documents/the-product-kitchen/Playground/first-misread && uv run pytest tests/test_cli.py -v -k "revision_of or no_history or history"`
Expected: All 4 new tests PASS

- [ ] **Step 5: Run full test suite**

Run: `cd /Users/I578221/Library/CloudStorage/OneDrive-SAPSE/Documents/the-product-kitchen/Playground/first-misread && uv run pytest tests/ -v`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/I578221/Library/CloudStorage/OneDrive-SAPSE/Documents/the-product-kitchen/Playground/first-misread
git add src/first_misread/cli.py tests/test_cli.py
git commit -m "feat(cli): add --revision-of, --no-history, --history flags"
```

---

### Task 8: Integration Test — Full Revision Flow

**Files:**
- Test: `tests/test_revision_flow.py`

- [ ] **Step 1: Write integration test for the full revision flow**

```python
# tests/test_revision_flow.py

import json
from pathlib import Path
from unittest.mock import AsyncMock

from first_misread.pipeline import run_pipeline


def _make_persona_response(persona_name: str, findings: list[dict]) -> dict:
    return {
        "persona": persona_name,
        "behavior_executed": f"{persona_name} read the content",
        "time_simulated": "30s",
        "overall_verdict": f"{persona_name} verdict",
        "findings": findings,
    }


def _make_finding_response(passage: str, severity: str = "high") -> dict:
    return {
        "type": "confusion",
        "severity": severity,
        "passage": passage,
        "location": "paragraph 1",
        "what_happened": f"Problem with: {passage[:30]}",
        "what_persona_understood": "misread",
        "what_author_likely_meant": "something else",
    }


async def test_full_revision_flow(tmp_path):
    """Test: run v1, then run v2 with --revision-of, verify diff and interpreter."""
    personas_dir = tmp_path / "personas"
    personas_dir.mkdir()
    (personas_dir / "core").mkdir()
    (personas_dir / "dynamic").mkdir()
    (personas_dir / "custom").mkdir()

    core_persona = personas_dir / "core" / "scanner.yaml"
    core_persona.write_text("""
name: The Scanner
type: core
behavior: Scan the content quickly
focus:
  - structure
stops_when: 30 seconds pass
""")

    output_dir = tmp_path / "output"
    output_dir.mkdir()

    v1_text = " ".join(["word"] * 60) + " The opening line feels unearned."

    mock_client_v1 = AsyncMock()
    mock_client_v1.model = "claude-sonnet-4-6"
    mock_client_v1.call = AsyncMock(side_effect=[
        {"dynamic_personas": []},
        _make_persona_response("The Scanner", [
            _make_finding_response("The opening line feels unearned"),
        ]),
    ])

    result_v1 = await run_pipeline(
        text=v1_text,
        personas_dir=personas_dir,
        output_dir=output_dir,
        client=mock_client_v1,
        include_rewrites=False,
    )

    assert (result_v1 / "run.json").exists()
    assert (result_v1 / "input.md").exists()
    assert (output_dir / "history.json").exists()

    v1_record = json.loads((result_v1 / "run.json").read_text())
    v1_run_id = v1_record["run_id"]
    v1_slug = v1_record["slug"]

    v2_text = " ".join(["word"] * 60) + " The revised opening is better."

    mock_client_v2 = AsyncMock()
    mock_client_v2.model = "claude-sonnet-4-6"
    mock_client_v2.call = AsyncMock(side_effect=[
        {"dynamic_personas": []},
        _make_persona_response("The Scanner", [
            _make_finding_response("A brand new issue", severity="medium"),
        ]),
        {
            "what_landed": ["Opening line was fixed"],
            "what_persists": [],
            "what_regressed": [],
            "revision_pattern": "Targeted fix on flagged passage",
            "suggestion": "Check the middle section next",
        },
    ])

    result_v2 = await run_pipeline(
        text=v2_text,
        personas_dir=personas_dir,
        output_dir=output_dir,
        client=mock_client_v2,
        include_rewrites=False,
        revision_of=v1_slug,
    )

    assert (result_v2 / "run.json").exists()
    assert (result_v2 / "revision-notes.md").exists()

    v2_record = json.loads((result_v2 / "run.json").read_text())
    assert v2_record["parent_run_id"] == v1_run_id

    summary = (result_v2 / "summary.md").read_text()
    assert "Changes from previous run" in summary

    revision_notes = (result_v2 / "revision-notes.md").read_text()
    assert "Opening line was fixed" in revision_notes

    history = json.loads((output_dir / "history.json").read_text())
    chain_key = list(history["chains"].keys())[0]
    assert len(history["chains"][chain_key]) == 2
```

- [ ] **Step 2: Run the integration test**

Run: `cd /Users/I578221/Library/CloudStorage/OneDrive-SAPSE/Documents/the-product-kitchen/Playground/first-misread && uv run pytest tests/test_revision_flow.py -v`
Expected: PASS (if all prior tasks are complete). If it fails, debug the specific failure — this test exercises the full flow.

- [ ] **Step 3: Run full test suite**

Run: `cd /Users/I578221/Library/CloudStorage/OneDrive-SAPSE/Documents/the-product-kitchen/Playground/first-misread && uv run pytest tests/ -v`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
cd /Users/I578221/Library/CloudStorage/OneDrive-SAPSE/Documents/the-product-kitchen/Playground/first-misread
git add tests/test_revision_flow.py
git commit -m "test: add integration test for full revision flow (v1 → v2)"
```
