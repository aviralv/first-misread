"""Pydantic models for the First Misread pipeline."""

from typing import Literal

from pydantic import BaseModel, computed_field


class PersonaConfig(BaseModel):
    """A persona loaded from YAML."""

    name: str
    type: Literal["core", "dynamic", "custom"]
    behavior: str
    focus: list[str]
    stops_when: str
    output_schema: dict | None = None  # documentation only


class ContentMetadata(BaseModel):
    """Structural analysis of input content."""

    word_count: int
    estimated_read_time_minutes: float
    paragraph_count: int
    heading_count: int
    has_lists: bool
    has_links: bool
    sentence_count: int
    avg_sentence_length: float


class Finding(BaseModel):
    """A single finding from a persona simulation."""

    type: Literal["confusion", "lost_interest", "misread", "skipped", "duplication", "structural"]
    severity: Literal["high", "medium", "low"]
    passage: str
    location: str
    what_happened: str
    what_persona_understood: str
    what_author_likely_meant: str


class PersonaResult(BaseModel):
    """Full result from a single persona simulation."""

    persona: str
    behavior_executed: str
    time_simulated: str
    overall_verdict: str
    findings: list[Finding]


class AggregatedFinding(BaseModel):
    """A finding merged across multiple personas."""

    passage: str
    location: str
    severity: Literal["high", "medium", "low"]
    personas: list[str]
    descriptions: list[dict]

    @computed_field
    @property
    def signal_strength(self) -> str:
        n = len(self.personas)
        return f"flagged by {n} persona{'s' if n != 1 else ''}"


class RewriteSuggestion(BaseModel):
    """A rewrite suggestion for a flagged passage."""

    original_passage: str
    problem_summary: str
    suggested_rewrite: str
    personas_that_flagged: list[str]


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


class Strength(BaseModel):
    """A passage identified as load-bearing during the What's Landing step."""

    passage: str
    location: str
    why: str
