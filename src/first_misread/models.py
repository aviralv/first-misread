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

    type: Literal["confusion", "lost_interest", "misread", "skipped"]
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
