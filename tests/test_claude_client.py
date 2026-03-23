import pytest
import json
from unittest.mock import AsyncMock, MagicMock
from first_misread.claude_client import ClaudeClient


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


async def test_call_with_retry_on_failure():
    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(
        side_effect=Exception("rate limited")
    )

    client = ClaudeClient(client=mock_client, max_retries=1)
    result = await client.call(system="test", user="test")
    assert result is None
