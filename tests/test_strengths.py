from unittest.mock import AsyncMock
from first_misread.strengths import identify_strengths
from first_misread.models import ContentMetadata, PersonaResult, Finding


def _make_metadata():
    return ContentMetadata(
        word_count=800, estimated_read_time_minutes=4.0,
        paragraph_count=8, heading_count=2, has_lists=False,
        has_links=True, sentence_count=40, avg_sentence_length=20.0,
    )


def _make_results():
    return [
        PersonaResult(
            persona="The Scanner",
            behavior_executed="Scanned",
            time_simulated="12s",
            overall_verdict="Would not read further",
            findings=[
                Finding(
                    type="lost_interest", severity="high",
                    passage="In my experience", location="p1s1",
                    what_happened="Generic opening",
                    what_persona_understood="A blog post",
                    what_author_likely_meant="Setting context",
                ),
            ],
        ),
    ]


async def test_identify_strengths_returns_list():
    mock_client = AsyncMock()
    mock_client.call = AsyncMock(return_value={
        "strengths": [
            {
                "passage": "The word moves.",
                "location": "paragraph 8",
                "why": "Crystallizes the argument.",
            },
        ],
    })

    result = await identify_strengths(
        client=mock_client,
        text="Some text here.",
        metadata=_make_metadata(),
        results=_make_results(),
    )

    assert result is not None
    assert len(result) == 1
    assert result[0].passage == "The word moves."
    assert result[0].why == "Crystallizes the argument."


async def test_identify_strengths_api_failure():
    mock_client = AsyncMock()
    mock_client.call = AsyncMock(return_value=None)

    result = await identify_strengths(
        client=mock_client,
        text="Some text here.",
        metadata=_make_metadata(),
        results=_make_results(),
    )

    assert result is None


async def test_identify_strengths_excludes_broken_passages():
    mock_client = AsyncMock()
    mock_client.call = AsyncMock(return_value={
        "strengths": [
            {"passage": "A strong line.", "location": "p3", "why": "Anchor."},
        ],
    })

    results = _make_results()
    await identify_strengths(
        client=mock_client,
        text="Some text here.",
        metadata=_make_metadata(),
        results=results,
    )

    call_args = mock_client.call.call_args
    user_prompt = call_args[1].get("user") or call_args[0][1]
    assert "In my experience" in user_prompt
