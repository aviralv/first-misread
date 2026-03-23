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


async def test_select_returns_subset_of_dynamic(sample_metadata, dynamic_personas):
    mock_client = AsyncMock()
    mock_client.call = AsyncMock(return_value={"dynamic_personas": ["skeptic"]})

    result = await select_dynamic_personas(
        client=mock_client,
        text="Some claim-heavy content here.",
        metadata=sample_metadata,
        available_dynamic=dynamic_personas,
    )
    assert len(result) == 1
    assert result[0].name == "The Skeptic"
    assert all(isinstance(p, PersonaConfig) for p in result)


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
