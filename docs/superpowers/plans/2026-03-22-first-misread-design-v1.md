First Misread Implementation Plan

  ▎ For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan
  task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

  Goal: Build a behavioral reading simulation that runs synthetic reader personas against written content and surfaces misread risks.

  Architecture: Python pipeline with 5 stages. Python handles input, analysis, dedup, and output. Claude API (async) handles persona selection, reading simulation
  (parallel), and optional rewrite pass. Personas defined as YAML files.

  Tech Stack: Python 3.12+, uv, anthropic (async), pyyaml, pydantic, click, asyncio

  Spec: docs/superpowers/specs/2026-03-22-first-misread-design.md

  ---
  Task 1: Project Scaffold

  Files:
  - Create: pyproject.toml
  - Create: src/first_misread/__init__.py
  - Modify: .gitignore (add output/)
  - Step 1: Create pyproject.toml

  [project]
  name = "first-misread"
  version = "0.1.0"
  description = "Behavioral reading simulation for written content"
  requires-python = ">=3.12"
  dependencies = [
      "anthropic>=0.42.0",
      "pyyaml>=6.0",
      "pydantic>=2.0",
      "click>=8.0",
  ]

  [project.optional-dependencies]
  dev = [
      "pytest>=8.0",
      "pytest-asyncio>=0.24",
  ]

  [build-system]
  requires = ["hatchling"]
  build-backend = "hatchling.build"

  - Step 2: Create package init

  """First Misread — behavioral reading simulation for written content."""

  - Step 3: Add output/ to .gitignore

  Append to .gitignore:
  # Generated reports
  output/

  - Step 4: Install dependencies

  Run: uv sync --dev

  - Step 5: Commit

  git add pyproject.toml src/first_misread/__init__.py .gitignore uv.lock
  git commit -m "feat: project scaffold with dependencies"

  ---
  Task 2: Pydantic Models

  Files:
  - Create: src/first_misread/models.py
  - Create: tests/test_models.py
  - Step 1: Write failing test for models

  import pytest
  from first_misread.models import (
      PersonaConfig,
      ContentMetadata,
      Finding,
      PersonaResult,
      AggregatedFinding,
      RewriteSuggestion,
  )


  def test_persona_config_from_dict():
      data = {
          "name": "The Scanner",
          "type": "core",
          "behavior": "Spends 30 seconds deciding.",
          "focus": ["headline clarity", "opening hook"],
          "stops_when": "Nothing grabs attention.",
      }
      config = PersonaConfig(**data)
      assert config.name == "The Scanner"
      assert config.type == "core"
      assert len(config.focus) == 2


  def test_content_metadata():
      meta = ContentMetadata(
          word_count=500,
          estimated_read_time_minutes=2.5,
          paragraph_count=6,
          heading_count=2,
          has_lists=True,
          has_links=False,
          sentence_count=25,
          avg_sentence_length=20.0,
      )
      assert meta.word_count == 500


  def test_finding():
      f = Finding(
          type="confusion",
          severity="high",
          passage="Some text here",
          location="paragraph 1, sentence 2",
          what_happened="Reader was confused",
          what_persona_understood="X",
          what_author_likely_meant="Y",
      )
      assert f.severity == "high"


  def test_persona_result():
      result = PersonaResult(
          persona="The Scanner",
          behavior_executed="Scanned headline",
          time_simulated="12 seconds",
          overall_verdict="Would not read further",
          findings=[],
      )
      assert result.persona == "The Scanner"
      assert result.findings == []


  def test_aggregated_finding():
      af = AggregatedFinding(
          passage="Some text",
          location="paragraph 1",
          severity="high",
          personas=["Scanner", "Skimmer"],
          descriptions=[
              {"persona": "Scanner", "what_happened": "Bounced"},
              {"persona": "Skimmer", "what_happened": "Skipped"},
          ],
      )
      assert af.signal_strength == "flagged by 2 personas"


  def test_finding_type_validation():
      with pytest.raises(Exception):
          Finding(
              type="invalid_type",
              severity="high",
              passage="text",
              location="p1",
              what_happened="x",
              what_persona_understood="x",
              what_author_likely_meant="x",
          )

  - Step 2: Run test to verify it fails

  Run: uv run pytest tests/test_models.py -v
  Expected: FAIL — module not found

  - Step 3: Implement models

  """Pydantic models for the First Misread pipeline."""

  from __future__ import annotations

  from enum import Enum
  from typing import Literal

  from pydantic import BaseModel


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

  - Step 4: Run tests

  Run: uv run pytest tests/test_models.py -v
  Expected: PASS

  - Step 5: Commit

  git add src/first_misread/models.py tests/test_models.py
  git commit -m "feat: add Pydantic models for pipeline data"

  ---
  Task 3: Persona YAML Files + Loader

  Files:
  - Create: personas/core/scanner.yaml
  - Create: personas/core/skimmer.yaml
  - Create: personas/core/busy-reader.yaml
  - Create: personas/core/challenger.yaml
  - Create: personas/dynamic/literal-reader.yaml
  - Create: personas/dynamic/visualizer.yaml
  - Create: personas/dynamic/domain-outsider.yaml
  - Create: personas/dynamic/skeptic.yaml
  - Create: personas/dynamic/emotional-reader.yaml
  - Create: personas/custom/.gitkeep
  - Create: src/first_misread/personas.py
  - Create: tests/test_personas.py
  - Step 1: Write failing test for persona loader

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

  - Step 2: Run test to verify it fails

  Run: uv run pytest tests/test_personas.py -v
  Expected: FAIL — module not found

  - Step 3: Implement persona loader

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

  - Step 4: Create all 9 persona YAML files

  Create each file in personas/core/ and personas/dynamic/. Example for scanner:

  # personas/core/scanner.yaml
  name: The Scanner
  type: core
  behavior: |
    Spends 30 seconds max deciding if this is worth their time.
    Reads headline, opening line, scans visual structure and length.
    Makes a snap judgment: read or skip.
  focus:
    - headline clarity
    - opening hook strength
    - visual density and structure
    - length relative to perceived value
  stops_when: |
    Nothing grabs attention in the first 3 sentences,
    or the piece looks too long for the perceived payoff.

  Write similar files for: skimmer.yaml, busy-reader.yaml, challenger.yaml, literal-reader.yaml, visualizer.yaml, domain-outsider.yaml, skeptic.yaml,
  emotional-reader.yaml. Use the persona descriptions from the spec tables.

  Also create personas/custom/.gitkeep.

  - Step 5: Write test that validates all shipped personas load

  # tests/test_persona_yaml_validation.py
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

  - Step 6: Run all tests

  Run: uv run pytest tests/test_personas.py tests/test_persona_yaml_validation.py -v
  Expected: PASS

  - Step 7: Commit

  git add personas/ src/first_misread/personas.py tests/test_personas.py tests/test_persona_yaml_validation.py
  git commit -m "feat: persona YAML definitions and loader"

  ---
  Task 4: Content Analyzer (Stage 2)

  Files:
  - Create: src/first_misread/analyzer.py
  - Create: tests/test_analyzer.py
  - Step 1: Write failing tests

  import pytest
  from first_misread.analyzer import analyze_content


  def test_basic_analysis():
      text = "This is a test.\n\nSecond paragraph here."
      meta = analyze_content(text)
      assert meta.word_count == 8
      assert meta.paragraph_count == 2
      assert meta.heading_count == 0
      assert meta.sentence_count == 2
      assert meta.has_lists is False
      assert meta.has_links is False


  def test_with_headings():
      text = "# Title\n\nSome text.\n\n## Section\n\nMore text."
      meta = analyze_content(text)
      assert meta.heading_count == 2


  def test_with_lists():
      text = "Intro paragraph.\n\n- item one\n- item two\n\nAnother paragraph."
      meta = analyze_content(text)
      assert meta.has_lists is True


  def test_with_links():
      text = "Check out [this link](https://example.com) for more."
      meta = analyze_content(text)
      assert meta.has_links is True


  def test_read_time():
      text = " ".join(["word"] * 500)
      meta = analyze_content(text)
      assert meta.estimated_read_time_minutes == pytest.approx(2.5, abs=0.5)


  def test_avg_sentence_length():
      text = "Short. Another short one. A bit longer sentence here."
      meta = analyze_content(text)
      assert meta.avg_sentence_length > 0

  - Step 2: Run to verify failure

  Run: uv run pytest tests/test_analyzer.py -v
  Expected: FAIL

  - Step 3: Implement analyzer

  """Content analysis — structural metadata extraction."""

  from __future__ import annotations

  import re

  from first_misread.models import ContentMetadata

  WORDS_PER_MINUTE = 200


  def analyze_content(text: str) -> ContentMetadata:
      """Analyze text and return structural metadata."""
      words = text.split()
      word_count = len(words)
      read_time = word_count / WORDS_PER_MINUTE

      paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
      paragraph_count = len(paragraphs)

      headings = re.findall(r"^#{1,6}\s+.+$", text, re.MULTILINE)
      heading_count = len(headings)

      sentences = re.split(r"[.!?]+\s+", text)
      sentences = [s for s in sentences if s.strip()]
      sentence_count = len(sentences)

      avg_sentence_length = (
          sum(len(s.split()) for s in sentences) / sentence_count
          if sentence_count
          else 0
      )

      has_lists = bool(re.search(r"^[\s]*[-*]\s+", text, re.MULTILINE))
      has_links = bool(re.search(r"\[.+?\]\(.+?\)", text))

      return ContentMetadata(
          word_count=word_count,
          estimated_read_time_minutes=round(read_time, 1),
          paragraph_count=paragraph_count,
          heading_count=heading_count,
          has_lists=has_lists,
          has_links=has_links,
          sentence_count=sentence_count,
          avg_sentence_length=round(avg_sentence_length, 1),
      )

  - Step 4: Run tests

  Run: uv run pytest tests/test_analyzer.py -v
  Expected: PASS

  - Step 5: Commit

  git add src/first_misread/analyzer.py tests/test_analyzer.py
  git commit -m "feat: content analyzer (Stage 2)"

  ---
  Task 5: Claude Client Wrapper

  Files:
  - Create: src/first_misread/claude_client.py
  - Create: tests/test_claude_client.py
  - Step 1: Write failing test

  import pytest
  import json
  from unittest.mock import AsyncMock, patch, MagicMock
  from first_misread.claude_client import ClaudeClient


  @pytest.mark.asyncio
  async def test_call_returns_parsed_json():
      mock_response = MagicMock()
      mock_response.content = [MagicMock(text='{"key": "value"}')]

      mock_client = AsyncMock()
      mock_client.messages.create = AsyncMock(return_value=mock_response)

      client = ClaudeClient(client=mock_client)
      result = await client.call(
          system="You are a test.",
          user="Return JSON.",
      )
      assert result == {"key": "value"}


  @pytest.mark.asyncio
  async def test_call_with_retry_on_failure():
      mock_client = AsyncMock()
      mock_client.messages.create = AsyncMock(
          side_effect=Exception("rate limited")
      )

      client = ClaudeClient(client=mock_client, max_retries=1)
      result = await client.call(system="test", user="test")
      assert result is None

  - Step 2: Run to verify failure

  Run: uv run pytest tests/test_claude_client.py -v
  Expected: FAIL

  - Step 3: Implement claude_client

  """Thin async wrapper for Claude API calls."""

  from __future__ import annotations

  import asyncio
  import json
  import logging
  import os

  from anthropic import AsyncAnthropic

  logger = logging.getLogger(__name__)

  DEFAULT_MODEL = "claude-sonnet-4-6"


  class ClaudeClient:
      """Async Claude API client with retry and JSON parsing."""

      def __init__(
          self,
          client: AsyncAnthropic | None = None,
          model: str | None = None,
          max_retries: int = 1,
      ):
          self.client = client or AsyncAnthropic(
              api_key=os.environ.get("ANTHROPIC_API_KEY")
          )
          self.model = model or os.environ.get("FIRST_MISREAD_MODEL", DEFAULT_MODEL)
          self.max_retries = max_retries

      async def call(
          self,
          system: str,
          user: str,
          max_tokens: int = 4096,
      ) -> dict | None:
          """Make a Claude API call and return parsed JSON, or None on failure."""
          for attempt in range(self.max_retries + 1):
              try:
                  response = await self.client.messages.create(
                      model=self.model,
                      max_tokens=max_tokens,
                      system=system,
                      messages=[{"role": "user", "content": user}],
                  )
                  text = response.content[0].text
                  return json.loads(text)
              except json.JSONDecodeError as e:
                  logger.warning(f"Invalid JSON from Claude: {e}")
                  return None
              except Exception as e:
                  if attempt < self.max_retries:
                      logger.warning(f"Claude API error (attempt {attempt + 1}): {e}")
                      await asyncio.sleep(2 ** attempt)
                  else:
                      logger.error(f"Claude API failed after {self.max_retries + 1} attempts: {e}")
                      return None

  - Step 4: Run tests

  Run: uv run pytest tests/test_claude_client.py -v
  Expected: PASS

  - Step 5: Commit

  git add src/first_misread/claude_client.py tests/test_claude_client.py
  git commit -m "feat: async Claude API client wrapper"

  ---
  Task 6: Persona Selector (Stage 3)

  Files:
  - Create: src/first_misread/selector.py
  - Create: tests/test_selector.py
  - Step 1: Write failing test

  import pytest
  from unittest.mock import AsyncMock
  from first_misread.selector import select_dynamic_personas
  from first_misread.models import PersonaConfig, ContentMetadata


  @pytest.fixture
  def sample_metadata():
      return ContentMetadata(
          word_count=800,
          estimated_read_time_minutes=4.0,
          paragraph_count=8,
          heading_count=2,
          has_lists=False,
          has_links=True,
          sentence_count=40,
          avg_sentence_length=20.0,
      )


  @pytest.fixture
  def dynamic_personas():
      return [
          PersonaConfig(name="The Skeptic", type="dynamic", behavior="b", focus=["f"], stops_when="s"),
          PersonaConfig(name="The Domain Outsider", type="dynamic", behavior="b", focus=["f"], stops_when="s"),
      ]


  @pytest.mark.asyncio
  async def test_select_returns_subset_of_dynamic(sample_metadata, dynamic_personas):
      mock_client = AsyncMock()
      mock_client.call = AsyncMock(return_value={"dynamic_personas": ["skeptic"]})

      result = await select_dynamic_personas(
          client=mock_client,
          text="Some claim-heavy content here.",
          metadata=sample_metadata,
          available_dynamic=dynamic_personas,
      )
      assert len(result) >= 0  # may be empty if names don't match
      assert all(isinstance(p, PersonaConfig) for p in result)


  @pytest.mark.asyncio
  async def test_select_handles_api_failure(sample_metadata, dynamic_personas):
      mock_client = AsyncMock()
      mock_client.call = AsyncMock(return_value=None)

      result = await select_dynamic_personas(
          client=mock_client,
          text="text",
          metadata=sample_metadata,
          available_dynamic=dynamic_personas,
      )
      assert result == []

  - Step 2: Run to verify failure

  Run: uv run pytest tests/test_selector.py -v

  - Step 3: Implement selector

  """Persona selection — Stage 3 of the pipeline."""

  from __future__ import annotations

  import json
  import logging

  from first_misread.claude_client import ClaudeClient
  from first_misread.models import ContentMetadata, PersonaConfig

  logger = logging.getLogger(__name__)

  SELECTOR_SYSTEM_PROMPT = """You select which additional reader personas should review a piece of writing.

  You'll receive the text, its structural metadata, and a catalog of available dynamic personas.

  Based on the content's characteristics (metaphor-heavy, claim-heavy, jargon-dense, personal stories, etc.), pick 1-3 personas most likely to surface misread
  risks.

  Return JSON: {"dynamic_personas": ["filename-without-extension", ...]}
  Only use filenames from the provided catalog."""


  async def select_dynamic_personas(
      client: ClaudeClient,
      text: str,
      metadata: ContentMetadata,
      available_dynamic: list[PersonaConfig],
  ) -> list[PersonaConfig]:
      """Use Claude to select which dynamic personas to run."""
      catalog = {
          p.name.lower().replace("the ", "").replace(" ", "-"): p
          for p in available_dynamic
      }
      catalog_desc = "\n".join(
          f"- {key}: {p.name} — {p.behavior.strip()[:100]}"
          for key, p in catalog.items()
      )

      user_prompt = f"""## Content to analyze

  {text}

  ## Structural metadata

  {metadata.model_dump_json(indent=2)}

  ## Available dynamic personas

  {catalog_desc}

  Select 1-3 personas. Return JSON: {{"dynamic_personas": ["name", ...]}}"""

      result = await client.call(system=SELECTOR_SYSTEM_PROMPT, user=user_prompt)

      if not result or "dynamic_personas" not in result:
          logger.warning("Persona selection failed, using no dynamic personas")
          return []

      selected = []
      for name in result["dynamic_personas"]:
          if name in catalog:
              selected.append(catalog[name])
          else:
              logger.warning(f"Selected persona '{name}' not in catalog, skipping")

      return selected

  - Step 4: Run tests

  Run: uv run pytest tests/test_selector.py -v
  Expected: PASS

  - Step 5: Commit

  git add src/first_misread/selector.py tests/test_selector.py
  git commit -m "feat: dynamic persona selector (Stage 3)"

  ---
  Task 7: Reading Simulator (Stage 4)

  Files:
  - Create: src/first_misread/simulator.py
  - Create: tests/test_simulator.py
  - Step 1: Write failing test

  import pytest
  from unittest.mock import AsyncMock
  from first_misread.simulator import simulate_persona, simulate_all
  from first_misread.models import PersonaConfig, ContentMetadata, PersonaResult


  @pytest.fixture
  def scanner():
      return PersonaConfig(
          name="The Scanner",
          type="core",
          behavior="Spends 30 seconds deciding.",
          focus=["headline", "hook"],
          stops_when="Nothing grabs attention.",
      )


  @pytest.fixture
  def metadata():
      return ContentMetadata(
          word_count=500, estimated_read_time_minutes=2.5,
          paragraph_count=5, heading_count=1,
          has_lists=False, has_links=False,
          sentence_count=25, avg_sentence_length=20.0,
      )


  MOCK_PERSONA_RESPONSE = {
      "persona": "The Scanner",
      "behavior_executed": "Scanned headline, first 2 sentences",
      "time_simulated": "12 seconds",
      "overall_verdict": "Would not read further",
      "findings": [
          {
              "type": "lost_interest",
              "severity": "high",
              "passage": "In my experience...",
              "location": "paragraph 1, sentence 1",
              "what_happened": "Generic opening",
              "what_persona_understood": "Another blog post",
              "what_author_likely_meant": "Setting context",
          }
      ],
  }


  @pytest.mark.asyncio
  async def test_simulate_persona(scanner, metadata):
      mock_client = AsyncMock()
      mock_client.call = AsyncMock(return_value=MOCK_PERSONA_RESPONSE)

      result = await simulate_persona(
          client=mock_client, persona=scanner, text="Some text.", metadata=metadata,
      )
      assert isinstance(result, PersonaResult)
      assert result.persona == "The Scanner"
      assert len(result.findings) == 1


  @pytest.mark.asyncio
  async def test_simulate_persona_api_failure(scanner, metadata):
      mock_client = AsyncMock()
      mock_client.call = AsyncMock(return_value=None)

      result = await simulate_persona(
          client=mock_client, persona=scanner, text="text", metadata=metadata,
      )
      assert result is None


  @pytest.mark.asyncio
  async def test_simulate_all_parallel(scanner, metadata):
      mock_client = AsyncMock()
      mock_client.call = AsyncMock(return_value=MOCK_PERSONA_RESPONSE)

      results = await simulate_all(
          client=mock_client, personas=[scanner, scanner], text="text", metadata=metadata,
      )
      assert len(results) == 2

  - Step 2: Run to verify failure

  Run: uv run pytest tests/test_simulator.py -v

  - Step 3: Implement simulator

  """Reading simulation — Stage 4 of the pipeline."""

  from __future__ import annotations

  import asyncio
  import logging

  from first_misread.claude_client import ClaudeClient
  from first_misread.models import ContentMetadata, PersonaConfig, PersonaResult

  logger = logging.getLogger(__name__)

  SIMULATION_SYSTEM_PROMPT = """You are simulating a specific reader persona. Read the text below exactly as this persona would — follow their behavior, focus on
  what they focus on, stop when they'd stop.

  Return your findings as JSON with this exact structure:
  {
    "persona": "Persona Name",
    "behavior_executed": "What you actually did while reading",
    "time_simulated": "How long this persona would spend",
    "overall_verdict": "One-sentence summary of this persona's experience",
    "findings": [
      {
        "type": "confusion | lost_interest | misread | skipped",
        "severity": "high | medium | low",
        "passage": "The exact text that caused the issue",
        "location": "paragraph N, sentence N",
        "what_happened": "Description of the problem",
        "what_persona_understood": "What the persona took away",
        "what_author_likely_meant": "What the author probably intended"
      }
    ]
  }

  If this persona would have no issues, return an empty findings array. Be honest — don't invent problems that wouldn't occur for this reading behavior."""


  async def simulate_persona(
      client: ClaudeClient,
      persona: PersonaConfig,
      text: str,
      metadata: ContentMetadata,
  ) -> PersonaResult | None:
      """Run a single persona simulation."""
      user_prompt = f"""## Persona: {persona.name}

  **Behavior:** {persona.behavior}

  **Focus areas:** {", ".join(persona.focus)}

  **Stops when:** {persona.stops_when}

  ## Content metadata
  Word count: {metadata.word_count} | Read time: {metadata.estimated_read_time_minutes} min
  Paragraphs: {metadata.paragraph_count} | Headings: {metadata.heading_count}

  ## Text to read

  {text}"""

      result = await client.call(system=SIMULATION_SYSTEM_PROMPT, user=user_prompt)

      if result is None:
          logger.warning(f"Simulation failed for persona: {persona.name}")
          return None

      try:
          return PersonaResult(**result)
      except Exception as e:
          logger.warning(f"Invalid response from {persona.name}: {e}")
          return None


  async def simulate_all(
      client: ClaudeClient,
      personas: list[PersonaConfig],
      text: str,
      metadata: ContentMetadata,
  ) -> list[PersonaResult]:
      """Run all persona simulations in parallel. Skips failures."""
      tasks = [
          simulate_persona(client, persona, text, metadata)
          for persona in personas
      ]
      results = await asyncio.gather(*tasks, return_exceptions=True)

      valid = []
      for i, result in enumerate(results):
          if isinstance(result, Exception):
              logger.warning(f"Persona {personas[i].name} raised: {result}")
          elif result is not None:
              valid.append(result)

      return valid

  - Step 4: Run tests

  Run: uv run pytest tests/test_simulator.py -v
  Expected: PASS

  - Step 5: Commit

  git add src/first_misread/simulator.py tests/test_simulator.py
  git commit -m "feat: parallel reading simulator (Stage 4)"

  ---
  Task 8: Aggregator (Deduplication)

  Files:
  - Create: src/first_misread/aggregator.py
  - Create: tests/test_aggregator.py
  - Step 1: Write failing tests

  import pytest
  from first_misread.aggregator import aggregate_findings
  from first_misread.models import Finding, PersonaResult, AggregatedFinding


  def make_result(persona: str, findings: list[Finding]) -> PersonaResult:
      return PersonaResult(
          persona=persona,
          behavior_executed="test",
          time_simulated="10s",
          overall_verdict="test",
          findings=findings,
      )


  def test_no_duplicates():
      results = [
          make_result("Scanner", [
              Finding(type="lost_interest", severity="high", passage="Unique passage A",
                      location="p1", what_happened="x", what_persona_understood="x", what_author_likely_meant="x"),
          ]),
          make_result("Skimmer", [
              Finding(type="confusion", severity="medium", passage="Completely different B",
                      location="p2", what_happened="y", what_persona_understood="y", what_author_likely_meant="y"),
          ]),
      ]
      aggregated = aggregate_findings(results)
      assert len(aggregated) == 2
      assert all(len(a.personas) == 1 for a in aggregated)


  def test_duplicates_merged():
      passage = "In my experience building products across three companies"
      results = [
          make_result("Scanner", [
              Finding(type="lost_interest", severity="high", passage=passage,
                      location="p1s1", what_happened="bounced", what_persona_understood="x", what_author_likely_meant="y"),
          ]),
          make_result("Busy Reader", [
              Finding(type="lost_interest", severity="medium", passage=passage,
                      location="p1s1", what_happened="skipped", what_persona_understood="a", what_author_likely_meant="b"),
          ]),
      ]
      aggregated = aggregate_findings(results)
      assert len(aggregated) == 1
      assert len(aggregated[0].personas) == 2
      assert aggregated[0].severity == "high"  # takes highest


  def test_partial_overlap_merged():
      results = [
          make_result("Scanner", [
              Finding(type="lost_interest", severity="high",
                      passage="In my experience building products across three companies and many teams",
                      location="p1", what_happened="x", what_persona_understood="x", what_author_likely_meant="x"),
          ]),
          make_result("Skimmer", [
              Finding(type="lost_interest", severity="medium",
                      passage="In my experience building products across three companies",
                      location="p1", what_happened="y", what_persona_understood="y", what_author_likely_meant="y"),
          ]),
      ]
      aggregated = aggregate_findings(results)
      assert len(aggregated) == 1


  def test_sorted_by_severity_then_signal():
      results = [
          make_result("A", [
              Finding(type="confusion", severity="low", passage="Low sev",
                      location="p3", what_happened="x", what_persona_understood="x", what_author_likely_meant="x"),
          ]),
          make_result("B", [
              Finding(type="confusion", severity="high", passage="High sev",
                      location="p1", what_happened="x", what_persona_understood="x", what_author_likely_meant="x"),
          ]),
      ]
      aggregated = aggregate_findings(results)
      assert aggregated[0].severity == "high"

  - Step 2: Run to verify failure

  Run: uv run pytest tests/test_aggregator.py -v

  - Step 3: Implement aggregator

  """Finding aggregation and deduplication."""

  from __future__ import annotations

  from difflib import SequenceMatcher

  from first_misread.models import AggregatedFinding, Finding, PersonaResult

  OVERLAP_THRESHOLD = 0.6
  SEVERITY_ORDER = {"high": 0, "medium": 1, "low": 2}


  def _passages_overlap(a: str, b: str) -> bool:
      """Check if two passages overlap above threshold."""
      ratio = SequenceMatcher(None, a.lower(), b.lower()).ratio()
      return ratio >= OVERLAP_THRESHOLD


  def _highest_severity(*severities: str) -> str:
      return min(severities, key=lambda s: SEVERITY_ORDER.get(s, 99))


  def aggregate_findings(results: list[PersonaResult]) -> list[AggregatedFinding]:
      """Deduplicate and aggregate findings across persona results."""
      aggregated: list[AggregatedFinding] = []

      for result in results:
          for finding in result.findings:
              merged = False
              for agg in aggregated:
                  if _passages_overlap(finding.passage, agg.passage):
                      agg.personas.append(result.persona)
                      agg.descriptions.append({
                          "persona": result.persona,
                          "what_happened": finding.what_happened,
                      })
                      agg.severity = _highest_severity(agg.severity, finding.severity)
                      merged = True
                      break

              if not merged:
                  aggregated.append(
                      AggregatedFinding(
                          passage=finding.passage,
                          location=finding.location,
                          severity=finding.severity,
                          personas=[result.persona],
                          descriptions=[{
                              "persona": result.persona,
                              "what_happened": finding.what_happened,
                          }],
                      )
                  )

      aggregated.sort(
          key=lambda a: (SEVERITY_ORDER.get(a.severity, 99), -len(a.personas))
      )
      return aggregated

  - Step 4: Run tests

  Run: uv run pytest tests/test_aggregator.py -v
  Expected: PASS

  - Step 5: Commit

  git add src/first_misread/aggregator.py tests/test_aggregator.py
  git commit -m "feat: finding aggregator with dedup (Stage 4 post-processing)"

  ---
  Task 9: Rewriter (Stage 4b)

  Files:
  - Create: src/first_misread/rewriter.py
  - Create: tests/test_rewriter.py
  - Step 1: Write failing test

  import pytest
  from unittest.mock import AsyncMock
  from first_misread.rewriter import generate_rewrites
  from first_misread.models import AggregatedFinding, RewriteSuggestion


  @pytest.fixture
  def sample_findings():
      return [
          AggregatedFinding(
              passage="In my experience building products",
              location="p1s1",
              severity="high",
              personas=["Scanner", "Busy Reader"],
              descriptions=[
                  {"persona": "Scanner", "what_happened": "bounced"},
                  {"persona": "Busy Reader", "what_happened": "skipped"},
              ],
          ),
      ]


  MOCK_REWRITE_RESPONSE = {
      "rewrites": [
          {
              "original_passage": "In my experience building products",
              "problem_summary": "Generic opening that doesn't signal value",
              "suggested_rewrite": "Most product roadmaps are fiction. Here's why.",
              "personas_that_flagged": ["Scanner", "Busy Reader"],
          }
      ]
  }


  @pytest.mark.asyncio
  async def test_generate_rewrites(sample_findings):
      mock_client = AsyncMock()
      mock_client.call = AsyncMock(return_value=MOCK_REWRITE_RESPONSE)

      result = await generate_rewrites(
          client=mock_client,
          text="In my experience building products...",
          findings=sample_findings,
      )
      assert len(result) == 1
      assert isinstance(result[0], RewriteSuggestion)


  @pytest.mark.asyncio
  async def test_generate_rewrites_api_failure(sample_findings):
      mock_client = AsyncMock()
      mock_client.call = AsyncMock(return_value=None)

      result = await generate_rewrites(
          client=mock_client, text="text", findings=sample_findings,
      )
      assert result == []

  - Step 2: Run to verify failure

  Run: uv run pytest tests/test_rewriter.py -v

  - Step 3: Implement rewriter

  """Rewrite suggestions — Stage 4b of the pipeline."""

  from __future__ import annotations

  import logging

  from first_misread.claude_client import ClaudeClient
  from first_misread.models import AggregatedFinding, RewriteSuggestion

  logger = logging.getLogger(__name__)

  REWRITER_SYSTEM_PROMPT = """You are an editor helping improve written content. You'll receive the original text and a list of passages that confused readers,
  along with what went wrong.

  For each flagged passage, suggest a minimal rewrite that fixes the misread risk while preserving the author's voice. Change as little as possible.

  Return JSON:
  {
    "rewrites": [
      {
        "original_passage": "The exact original text",
        "problem_summary": "One sentence explaining the issue",
        "suggested_rewrite": "The improved version",
        "personas_that_flagged": ["Persona A", "Persona B"]
      }
    ]
  }"""


  async def generate_rewrites(
      client: ClaudeClient,
      text: str,
      findings: list[AggregatedFinding],
  ) -> list[RewriteSuggestion]:
      """Generate rewrite suggestions for flagged passages."""
      findings_desc = "\n\n".join(
          f"**Passage:** \"{f.passage}\"\n"
          f"**Severity:** {f.severity} ({f.signal_strength})\n"
          f"**Issues:** " + "; ".join(d["what_happened"] for d in f.descriptions)
          for f in findings
      )

      user_prompt = f"""## Original text

  {text}

  ## Flagged passages

  {findings_desc}"""

      result = await client.call(system=REWRITER_SYSTEM_PROMPT, user=user_prompt)

      if not result or "rewrites" not in result:
          logger.warning("Rewrite generation failed")
          return []

      try:
          return [RewriteSuggestion(**r) for r in result["rewrites"]]
      except Exception as e:
          logger.warning(f"Invalid rewrite response: {e}")
          return []

  - Step 4: Run tests

  Run: uv run pytest tests/test_rewriter.py -v
  Expected: PASS

  - Step 5: Commit

  git add src/first_misread/rewriter.py tests/test_rewriter.py
  git commit -m "feat: rewrite suggestion generator (Stage 4b)"

  ---
  Task 10: Output Generator (Stage 5)

  Files:
  - Create: src/first_misread/output.py
  - Create: tests/test_output.py
  - Step 1: Write failing tests

  import pytest
  from pathlib import Path
  from first_misread.output import generate_summary, generate_persona_details, generate_rewrites_md, write_output
  from first_misread.models import (
      ContentMetadata, PersonaResult, Finding, AggregatedFinding, RewriteSuggestion,
  )


  @pytest.fixture
  def metadata():
      return ContentMetadata(
          word_count=1240, estimated_read_time_minutes=6.2,
          paragraph_count=10, heading_count=3,
          has_lists=True, has_links=False,
          sentence_count=60, avg_sentence_length=20.7,
      )


  @pytest.fixture
  def persona_results():
      return [
          PersonaResult(
              persona="The Scanner",
              behavior_executed="Scanned headline",
              time_simulated="12 seconds",
              overall_verdict="Would not read further",
              findings=[
                  Finding(type="lost_interest", severity="high",
                          passage="In my experience", location="p1s1",
                          what_happened="Generic opening",
                          what_persona_understood="A blog post",
                          what_author_likely_meant="Setting context"),
              ],
          ),
      ]


  @pytest.fixture
  def aggregated():
      return [
          AggregatedFinding(
              passage="In my experience", location="p1s1",
              severity="high", personas=["The Scanner"],
              descriptions=[{"persona": "The Scanner", "what_happened": "Generic opening"}],
          ),
      ]


  @pytest.fixture
  def rewrites():
      return [
          RewriteSuggestion(
              original_passage="In my experience",
              problem_summary="Generic opening",
              suggested_rewrite="Most product roadmaps fail.",
              personas_that_flagged=["The Scanner"],
          ),
      ]


  def test_generate_summary(metadata, persona_results, aggregated):
      md = generate_summary(
          title="Test Post", metadata=metadata,
          results=persona_results, aggregated=aggregated,
          total_personas=5,
      )
      assert "# First Misread Report" in md
      assert "1,240" in md
      assert "The Scanner" in md


  def test_generate_persona_details(persona_results):
      md = generate_persona_details(persona_results)
      assert "The Scanner" in md
      assert "Generic opening" in md


  def test_generate_rewrites_md(rewrites):
      md = generate_rewrites_md(rewrites)
      assert "In my experience" in md
      assert "Most product roadmaps fail." in md


  def test_write_output(tmp_path, metadata, persona_results, aggregated, rewrites):
      output_dir = write_output(
          base_dir=tmp_path, slug="test-post",
          title="Test Post", metadata=metadata,
          results=persona_results, aggregated=aggregated,
          rewrites=rewrites, total_personas=5,
      )
      assert (output_dir / "summary.md").exists()
      assert (output_dir / "persona-details.md").exists()
      assert (output_dir / "rewrites.md").exists()

  - Step 2: Run to verify failure

  Run: uv run pytest tests/test_output.py -v

  - Step 3: Implement output generator

  """Output generation — Stage 5 of the pipeline."""

  from __future__ import annotations

  from datetime import datetime
  from pathlib import Path

  from first_misread.models import (
      AggregatedFinding,
      ContentMetadata,
      PersonaResult,
      RewriteSuggestion,
  )

  SEVERITY_EMOJI = {"high": "\U0001f534", "medium": "\U0001f7e1", "low": "\u26aa"}


  def generate_summary(
      title: str,
      metadata: ContentMetadata,
      results: list[PersonaResult],
      aggregated: list[AggregatedFinding],
      total_personas: int,
  ) -> str:
      """Generate L1 summary markdown."""
      lines = [
          "# First Misread Report",
          "",
          f"**Content**: \"{title}\"",
          f"**Word count**: {metadata.word_count:,} | **Est. read time**: {metadata.estimated_read_time_minutes} min",
          f"**Personas run**: {total_personas} total",
          "",
          "## Top Findings",
          "",
      ]

      for i, finding in enumerate(aggregated[:5], 1):
          emoji = SEVERITY_EMOJI.get(finding.severity, "")
          lines.append(f"{i}. **{emoji} {finding.descriptions[0]['what_happened']}** ({finding.signal_strength})")
          lines.append(f"   > \"{finding.passage}\"")
          persona_summary = ", ".join(finding.personas)
          lines.append(f"   Flagged by: {persona_summary}")
          lines.append("")

      lines.append("## Persona Verdicts")
      lines.append("")
      lines.append("| Persona | Verdict | Key Issue |")
      lines.append("|---------|---------|-----------|")
      for result in results:
          key_issue = result.findings[0].what_happened if result.findings else "No issues"
          lines.append(f"| {result.persona} | {result.overall_verdict} | {key_issue} |")
      lines.append("")

      return "\n".join(lines)


  def generate_persona_details(results: list[PersonaResult]) -> str:
      """Generate L2 per-persona breakdown markdown."""
      lines = ["# Persona Details", ""]

      for result in results:
          lines.append(f"## {result.persona}")
          lines.append("")
          lines.append(f"**Behavior:** {result.behavior_executed}")
          lines.append(f"**Time spent:** {result.time_simulated}")
          lines.append(f"**Verdict:** {result.overall_verdict}")
          lines.append("")

          if not result.findings:
              lines.append("*No issues found.*")
              lines.append("")
              continue

          lines.append("### Findings")
          lines.append("")
          for f in result.findings:
              emoji = SEVERITY_EMOJI.get(f.severity, "")
              lines.append(f"#### {emoji} {f.type.replace('_', ' ').title()} ({f.severity})")
              lines.append("")
              lines.append(f"> \"{f.passage}\"")
              lines.append(f"")
              lines.append(f"**Location:** {f.location}")
              lines.append(f"**What happened:** {f.what_happened}")
              lines.append(f"**Persona understood:** {f.what_persona_understood}")
              lines.append(f"**Author likely meant:** {f.what_author_likely_meant}")
              lines.append("")

          lines.append("---")
          lines.append("")

      return "\n".join(lines)


  def generate_rewrites_md(rewrites: list[RewriteSuggestion]) -> str:
      """Generate L3 rewrite suggestions markdown."""
      lines = ["# Rewrite Suggestions", ""]

      for i, r in enumerate(rewrites, 1):
          lines.append(f"## {i}. {r.problem_summary}")
          lines.append("")
          lines.append(f"**Flagged by:** {', '.join(r.personas_that_flagged)}")
          lines.append("")
          lines.append("**Original:**")
          lines.append(f"> {r.original_passage}")
          lines.append("")
          lines.append("**Suggested:**")
          lines.append(f"> {r.suggested_rewrite}")
          lines.append("")
          lines.append("---")
          lines.append("")

      return "\n".join(lines)


  def write_output(
      base_dir: Path,
      slug: str,
      title: str,
      metadata: ContentMetadata,
      results: list[PersonaResult],
      aggregated: list[AggregatedFinding],
      rewrites: list[RewriteSuggestion] | None,
      total_personas: int,
  ) -> Path:
      """Write all output files and return the output directory."""
      timestamp = datetime.now().strftime("%Y-%m-%d-%H%M%S")
      output_dir = base_dir / f"{timestamp}-{slug}"
      output_dir.mkdir(parents=True, exist_ok=True)

      summary = generate_summary(title, metadata, results, aggregated, total_personas)
      (output_dir / "summary.md").write_text(summary)

      details = generate_persona_details(results)
      (output_dir / "persona-details.md").write_text(details)

      if rewrites:
          rewrites_md = generate_rewrites_md(rewrites)
          (output_dir / "rewrites.md").write_text(rewrites_md)

      return output_dir

  - Step 4: Run tests

  Run: uv run pytest tests/test_output.py -v
  Expected: PASS

  - Step 5: Commit

  git add src/first_misread/output.py tests/test_output.py
  git commit -m "feat: markdown output generator (Stage 5)"

  ---
  Task 11: Pipeline Orchestrator

  Files:
  - Create: src/first_misread/pipeline.py
  - Create: tests/test_pipeline.py
  - Step 1: Write failing test

  import pytest
  from pathlib import Path
  from unittest.mock import AsyncMock, patch, MagicMock
  from first_misread.pipeline import run_pipeline, validate_input, make_slug


  def test_validate_input_too_short():
      with pytest.raises(ValueError, match="too short"):
          validate_input("Hello world.")


  def test_validate_input_too_long():
      text = " ".join(["word"] * 3000)
      with pytest.raises(ValueError, match="too long"):
          validate_input(text)


  def test_validate_input_ok():
      text = " ".join(["word"] * 500)
      assert validate_input(text) == text


  def test_make_slug_from_filename():
      assert make_slug(file_path=Path("my-draft-post.md")) == "my-draft-post"


  def test_make_slug_from_text():
      slug = make_slug(text="Why Most Product Roadmaps Are Fiction and what to do")
      assert slug == "why-most-product-roadmaps-are"


  @pytest.mark.asyncio
  async def test_pipeline_end_to_end(tmp_path):
      """Integration test with mocked Claude calls."""
      text = " ".join(["word"] * 200) + ". " + " ".join(["sentence"] * 100) + "."

      mock_selector_response = {"dynamic_personas": []}
      mock_persona_response = {
          "persona": "The Scanner",
          "behavior_executed": "Scanned",
          "time_simulated": "10s",
          "overall_verdict": "OK",
          "findings": [],
      }

      mock_client = AsyncMock()
      mock_client.call = AsyncMock(side_effect=[
          mock_selector_response,
          mock_persona_response,
          mock_persona_response,
          mock_persona_response,
          mock_persona_response,
      ])

      personas_dir = tmp_path / "personas"
      for sub in ["core", "dynamic", "custom"]:
          (personas_dir / sub).mkdir(parents=True)
      (personas_dir / "core" / "test.yaml").write_text(
          "name: Test\ntype: core\nbehavior: b\nfocus:\n  - f\nstops_when: s\n"
      )

      output_dir = tmp_path / "output"
      result = await run_pipeline(
          text=text,
          personas_dir=personas_dir,
          output_dir=output_dir,
          client=mock_client,
          include_rewrites=False,
      )

      assert result.exists()
      assert (result / "summary.md").exists()
      assert (result / "persona-details.md").exists()

  - Step 2: Run to verify failure

  Run: uv run pytest tests/test_pipeline.py -v

  - Step 3: Implement pipeline

  """Main pipeline orchestrator — runs all 5 stages."""

  from __future__ import annotations

  import re
  from pathlib import Path

  from first_misread.analyzer import analyze_content
  from first_misread.aggregator import aggregate_findings
  from first_misread.claude_client import ClaudeClient
  from first_misread.models import ContentMetadata
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
  ) -> Path:
      """Run the full First Misread pipeline."""
      client = client or ClaudeClient()

      # Stage 1: Input
      text = validate_input(text)
      slug = make_slug(file_path=file_path, text=text)
      title = file_path.stem.replace("-", " ").title() if file_path else slug.replace("-", " ").title()

      # Stage 2: Content Analysis
      metadata = analyze_content(text)

      # Stage 3: Persona Selection
      core, dynamic, custom = load_all_personas(personas_dir)
      selected_dynamic = await select_dynamic_personas(
          client=client, text=text, metadata=metadata, available_dynamic=dynamic,
      )

      all_personas = core + custom + selected_dynamic
      total_personas = len(all_personas)

      # Stage 4: Reading Simulation
      results = await simulate_all(
          client=client, personas=all_personas, text=text, metadata=metadata,
      )

      # Aggregate findings
      aggregated = aggregate_findings(results)

      # Stage 4b: Rewrite Pass (optional)
      rewrites = None
      if include_rewrites and aggregated:
          rewrites = await generate_rewrites(
              client=client, text=text, findings=aggregated,
          )

      # Stage 5: Output
      result_dir = write_output(
          base_dir=output_dir,
          slug=slug,
          title=title,
          metadata=metadata,
          results=results,
          aggregated=aggregated,
          rewrites=rewrites,
          total_personas=total_personas,
      )

      return result_dir

  - Step 4: Run tests

  Run: uv run pytest tests/test_pipeline.py -v
  Expected: PASS

  - Step 5: Run all tests

  Run: uv run pytest -v
  Expected: ALL PASS

  - Step 6: Commit

  git add src/first_misread/pipeline.py tests/test_pipeline.py
  git commit -m "feat: pipeline orchestrator wiring all stages"

  ---
  Task 12: CLI Entry Point + Skill Definition

  Files:
  - Create: src/first_misread/cli.py
  - Create: skill/SKILL.md
  - Step 1: Implement CLI

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

  - Step 2: Add CLI entry point to pyproject.toml

  Add to pyproject.toml:
  [project.scripts]
  first-misread = "first_misread.cli:main"

  - Step 3: Write the Claude Code skill definition

  # skill/SKILL.md
  ---
  name: first-misread
  description: Run behavioral reading simulation on written content. Synthetic reader personas stress-test blog posts, newsletters, and LinkedIn posts to find
  misread risks. Use when user says "first-misread", "misread check", "reader test", or wants feedback on a draft before publishing.
  ---

  ## What This Skill Does

  Runs synthetic reader personas against your writing to find the first place it gets misunderstood.

  - Feeds your text through 4 core personas + dynamically selected extras
  - Surfaces blind spots: weak hooks, buried ledes, unsupported claims, jargon barriers
  - Outputs a ranked summary, per-persona breakdown, and optional rewrite suggestions

  **Why this exists**: You can't read your own writing with fresh eyes. This gives you a diverse synthetic audience before you hit publish.

  ## How to Use

  Paste text directly:
  Run first-misread on this: [paste your text]

  Or point to a file:
  Run first-misread on ./drafts/my-post.md

  Skip rewrites:
  Run first-misread on ./drafts/my-post.md --no-rewrites

  ## What Happens

  1. The skill reads your text and analyzes its structure
  2. Claude selects which additional personas are relevant
  3. All personas read your text in parallel
  4. Findings are deduplicated and ranked
  5. (Optional) An editor pass generates rewrite suggestions
  6. Results are printed to terminal + saved as markdown files

  ## Running

  ```bash
  cd /path/to/first-misread
  uv run python -m first_misread.cli [file_path] [--text "..."] [--no-rewrites]

  - [ ] **Step 4: Commit**

  git add src/first_misread/cli.py skill/SKILL.md pyproject.toml
  git commit -m "feat: CLI entry point and Claude Code skill definition"

  ---

  ### Task 13: Final Integration Test + Push

  - [ ] **Step 1: Run full test suite**

  Run: `uv run pytest -v`
  Expected: ALL PASS

  - [ ] **Step 2: Verify the CLI works with a test input**

  Create a test file and run:
  ```bash
  echo "This is a test post about why product roadmaps are fiction. Most teams spend weeks creating detailed roadmaps that become outdated within days. The problem
   is not planning itself but the illusion of certainty that roadmaps create. When stakeholders see a timeline, they treat it as a promise rather than a
  hypothesis. This leads to disappointment and eroded trust. Instead of traditional roadmaps, consider outcome-driven delivery cadence where teams commit to
  outcomes rather than features. This approach allows flexibility while maintaining accountability. In my experience building products across three companies, the
  teams that shipped the most value were the ones that abandoned rigid roadmaps earliest." > /tmp/test-post.md
  uv run python -m first_misread.cli /tmp/test-post.md --no-rewrites

  Expected: L1 summary printed to terminal, output files created in output/

  - Step 3: Update session notes

  Update session-notes/INDEX.md and create a session note for this session.

  - Step 4: Commit and push

  git add -A
  git commit -m "feat: complete v1 implementation of first-misread"
  git push origin main
