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


async def test_simulate_persona(scanner, metadata):
    mock_client = AsyncMock()
    mock_client.call = AsyncMock(return_value=MOCK_PERSONA_RESPONSE)

    result = await simulate_persona(
        client=mock_client, persona=scanner, text="Some text.", metadata=metadata,
    )
    assert isinstance(result, PersonaResult)
    assert result.persona == "The Scanner"
    assert len(result.findings) == 1


async def test_simulate_persona_api_failure(scanner, metadata):
    mock_client = AsyncMock()
    mock_client.call = AsyncMock(return_value=None)

    result = await simulate_persona(
        client=mock_client, persona=scanner, text="text", metadata=metadata,
    )
    assert result is None


async def test_simulate_all_parallel(scanner, metadata):
    mock_client = AsyncMock()
    mock_client.call = AsyncMock(return_value=MOCK_PERSONA_RESPONSE)

    results = await simulate_all(
        client=mock_client, personas=[scanner, scanner], text="text", metadata=metadata,
    )
    assert len(results) == 2
