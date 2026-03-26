import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient, AnthropicClient, OpenAIClient, OpenAICompatibleClient } from '../src/core/llm-client.js';

describe('AnthropicClient', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('sends correct request format', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        content: [{ text: '{"result": "ok"}' }],
      }),
    }));

    const client = new AnthropicClient('test-key', 'claude-sonnet-4-6');
    const result = await client.call('system prompt', 'user prompt');

    expect(fetch).toHaveBeenCalledOnce();
    const [url, opts] = fetch.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(opts.headers['x-api-key']).toBe('test-key');
    const body = JSON.parse(opts.body);
    expect(body.system).toBe('system prompt');
    expect(body.messages[0].content).toBe('user prompt');
    expect(result).toEqual({ result: 'ok' });
  });

  it('strips code fences from response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        content: [{ text: '```json\n{"result": "ok"}\n```' }],
      }),
    }));

    const client = new AnthropicClient('key', 'model');
    const result = await client.call('sys', 'usr');
    expect(result).toEqual({ result: 'ok' });
  });

  it('returns null on invalid JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: [{ text: 'not json' }] }),
    }));

    const client = new AnthropicClient('key', 'model');
    expect(await client.call('sys', 'usr')).toBeNull();
  });

  it('returns null on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    const client = new AnthropicClient('key', 'model');
    expect(await client.call('sys', 'usr')).toBeNull();
  });
});

describe('OpenAIClient', () => {
  it('sends correct request format', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: '{"result": "ok"}' } }],
      }),
    }));

    const client = new OpenAIClient('test-key', 'gpt-4o');
    const result = await client.call('system prompt', 'user prompt');

    const [url, opts] = fetch.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(opts.headers['Authorization']).toBe('Bearer test-key');
    const body = JSON.parse(opts.body);
    expect(body.messages[0]).toEqual({ role: 'system', content: 'system prompt' });
    expect(body.messages[1]).toEqual({ role: 'user', content: 'user prompt' });
    expect(result).toEqual({ result: 'ok' });
  });
});

describe('createClient factory', () => {
  it('creates AnthropicClient', () => {
    const c = createClient('anthropic', { apiKey: 'k', model: 'm' });
    expect(c).toBeInstanceOf(AnthropicClient);
  });

  it('creates OpenAIClient', () => {
    const c = createClient('openai', { apiKey: 'k', model: 'm' });
    expect(c).toBeInstanceOf(OpenAIClient);
  });

  it('creates OpenAICompatibleClient for google', () => {
    const c = createClient('google', { apiKey: 'k', model: 'm' });
    expect(c).toBeInstanceOf(OpenAICompatibleClient);
  });

  it('creates OpenAICompatibleClient for openai-compatible', () => {
    const c = createClient('openai-compatible', { apiKey: 'k', model: 'm', baseUrl: 'http://localhost:1234' });
    expect(c).toBeInstanceOf(OpenAICompatibleClient);
  });
});
