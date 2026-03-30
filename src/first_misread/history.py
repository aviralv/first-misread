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
