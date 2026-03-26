import { describe, it, expect, vi } from 'vitest';
import { runPipeline, validateInput } from '../src/core/pipeline.js';

describe('validateInput', () => {
  it('rejects text under 50 words', () => {
    const short = Array(49).fill('word').join(' ');
    expect(() => validateInput(short)).toThrow(/too short/i);
  });

  it('rejects text over 2500 words', () => {
    const long = Array(2501).fill('word').join(' ');
    expect(() => validateInput(long)).toThrow(/too long/i);
  });

  it('accepts text at boundaries', () => {
    expect(() => validateInput(Array(50).fill('word').join(' '))).not.toThrow();
    expect(() => validateInput(Array(2500).fill('word').join(' '))).not.toThrow();
  });
});

describe('runPipeline', () => {
  it('runs full pipeline with mocked client and emits progress', async () => {
    const events = [];
    const mockClient = {
      call: vi.fn()
        .mockResolvedValueOnce({ dynamic_personas: ['skeptic'] })
        .mockResolvedValue({
          persona: 'Test',
          behavior_executed: 'tested',
          time_simulated: '1s',
          overall_verdict: 'ok',
          findings: [],
        }),
    };

    const text = Array(100).fill('word').join(' ');
    const result = await runPipeline(mockClient, text, (e) => events.push(e));

    expect(result.metadata.wordCount).toBe(100);
    expect(Array.isArray(result.personaResults)).toBe(true);
    expect(Array.isArray(result.aggregatedFindings)).toBe(true);
    expect(events.some(e => e.type === 'metadata')).toBe(true);
    expect(events.some(e => e.type === 'personas-selected')).toBe(true);
  });
});
