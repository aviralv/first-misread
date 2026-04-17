import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient, setHttpFunction } from '../src/core/llm-client.js';

describe('GeminiClient', () => {
  let lastRequest;

  beforeEach(() => {
    lastRequest = null;
    setHttpFunction(async (opts) => {
      lastRequest = opts;
      return {
        status: 200,
        json: {
          candidates: [{
            content: {
              parts: [{ text: '{"result": "ok"}' }]
            }
          }]
        },
        text: '',
      };
    });
  });

  it('sends request to native generateContent endpoint', async () => {
    const client = createClient('google', {
      apiKey: 'test-gemini-key',
      model: 'gemini-2.5-flash',
    });
    await client.call('system prompt', 'user prompt');

    expect(lastRequest.url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
    );
    expect(lastRequest.headers['x-goog-api-key']).toBe('test-gemini-key');
    expect(lastRequest.headers['Authorization']).toBeUndefined();
  });

  it('sends correct body format', async () => {
    const client = createClient('google', {
      apiKey: 'test-key',
      model: 'gemini-2.5-flash',
    });
    await client.call('sys', 'usr', 2048);

    const body = JSON.parse(lastRequest.body);
    expect(body.contents).toEqual([{ parts: [{ text: 'usr' }] }]);
    expect(body.systemInstruction).toEqual({ parts: [{ text: 'sys' }] });
    expect(body.generationConfig.maxOutputTokens).toBe(2048);
  });

  it('uses default model gemini-2.5-flash', async () => {
    const client = createClient('google', { apiKey: 'k' });
    await client.call('s', 'u');
    expect(lastRequest.url).toContain('gemini-2.5-flash:generateContent');
  });

  it('parses JSON from response candidates', async () => {
    const client = createClient('google', { apiKey: 'k' });
    const result = await client.call('s', 'u');
    expect(result).toEqual({ result: 'ok' });
  });
});

describe('AnthropicClient', () => {
  let lastRequest;

  beforeEach(() => {
    lastRequest = null;
    setHttpFunction(async (opts) => {
      lastRequest = opts;
      return {
        status: 200,
        json: { content: [{ text: '{"result": "ok"}' }] },
        text: '',
      };
    });
  });

  it('sends x-api-key header', async () => {
    const client = createClient('anthropic', { apiKey: 'ant-key' });
    await client.call('s', 'u');
    expect(lastRequest.headers['x-api-key']).toBe('ant-key');
    expect(lastRequest.headers['Authorization']).toBeUndefined();
  });
});

describe('OpenAIClient', () => {
  let lastRequest;

  beforeEach(() => {
    lastRequest = null;
    setHttpFunction(async (opts) => {
      lastRequest = opts;
      return {
        status: 200,
        json: { choices: [{ message: { content: '{"result": "ok"}' } }] },
        text: '',
      };
    });
  });

  it('sends Authorization Bearer header', async () => {
    const client = createClient('openai', { apiKey: 'oai-key' });
    await client.call('s', 'u');
    expect(lastRequest.headers['Authorization']).toBe('Bearer oai-key');
    expect(lastRequest.headers['x-api-key']).toBeUndefined();
    expect(lastRequest.headers['x-goog-api-key']).toBeUndefined();
  });
});
