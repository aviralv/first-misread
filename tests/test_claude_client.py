import pytest
import json
from unittest.mock import AsyncMock, MagicMock
from first_misread.claude_client import ClaudeClient, _strip_code_fences


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


async def test_call_strips_code_fences():
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text='```json\n{"key": "value"}\n```')]

    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=mock_response)

    client = ClaudeClient(client=mock_client)
    result = await client.call(system="test", user="test")
    assert result == {"key": "value"}


async def test_call_with_retry_on_failure():
    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(
        side_effect=Exception("rate limited")
    )

    client = ClaudeClient(client=mock_client, max_retries=1)
    result = await client.call(system="test", user="test")
    assert result is None


def test_strip_code_fences_with_json_tag():
    assert _strip_code_fences('```json\n{"a": 1}\n```') == '{"a": 1}'


def test_strip_code_fences_plain():
    assert _strip_code_fences('```\n{"a": 1}\n```') == '{"a": 1}'


def test_strip_code_fences_no_fences():
    assert _strip_code_fences('{"a": 1}') == '{"a": 1}'
