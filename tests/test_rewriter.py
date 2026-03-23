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


async def test_generate_rewrites_api_failure(sample_findings):
    mock_client = AsyncMock()
    mock_client.call = AsyncMock(return_value=None)

    result = await generate_rewrites(
        client=mock_client, text="text", findings=sample_findings,
    )
    assert result == []
