import pytest
import json
from unittest.mock import AsyncMock, MagicMock
from first_misread.claude_client import ClaudeClient, _strip_code_fences, _extract_json


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


def test_extract_json_strips_preamble():
    text = 'Here is my selection:\n{"dynamic_personas": ["skeptic"]}'
    assert _extract_json(text) == '{"dynamic_personas": ["skeptic"]}'


def test_extract_json_strips_preamble_and_suffix():
    text = 'Sure! Here you go:\n{"key": "value"}\nHope that helps!'
    assert _extract_json(text) == '{"key": "value"}'


def test_extract_json_handles_code_fences():
    text = '```json\n{"a": 1}\n```'
    assert _extract_json(text) == '{"a": 1}'


def test_extract_json_handles_clean_json():
    text = '{"a": 1}'
    assert _extract_json(text) == '{"a": 1}'


def test_extract_json_handles_array():
    text = 'Here: ["a", "b"]'
    assert _extract_json(text) == '["a", "b"]'


async def test_call_retries_on_json_error():
    good_response = MagicMock()
    good_response.content = [MagicMock(text='{"key": "value"}')]

    bad_response = MagicMock()
    bad_response.content = [MagicMock(text='not json at all')]

    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(
        side_effect=[bad_response, good_response]
    )

    client = ClaudeClient(client=mock_client, max_retries=1)
    result = await client.call(system="test", user="test")
    assert result == {"key": "value"}
    assert mock_client.messages.create.call_count == 2
