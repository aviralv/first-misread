import { describe, it, expect, vi } from 'vitest';
import { simulatePersona, simulateAll } from '../src/core/simulator.js';

const MOCK_PERSONA = {
  name: 'The Scanner', behavior: 'Scans quickly', focus: ['headlines'], stops_when: 'bored',
};
const MOCK_METADATA = { wordCount: 100, estimatedReadTimeMinutes: 0.5, paragraphCount: 2, headingCount: 1 };

describe('simulatePersona', () => {
  it('returns persona result on success', async () => {
    const mockClient = {
      call: vi.fn().mockResolvedValue({
        persona: 'The Scanner',
        behavior_executed: 'Scanned',
        time_simulated: '30s',
        overall_verdict: 'Fine',
        findings: [],
      }),
    };

    const result = await simulatePersona(mockClient, MOCK_PERSONA, 'text', MOCK_METADATA);
    expect(result.persona).toBe('The Scanner');
    expect(result.findings).toEqual([]);
  });

  it('returns null on API failure', async () => {
    const mockClient = { call: vi.fn().mockResolvedValue(null) };
    const result = await simulatePersona(mockClient, MOCK_PERSONA, 'text', MOCK_METADATA);
    expect(result).toBeNull();
  });
});

describe('simulateAll', () => {
  it('runs personas in parallel and filters nulls', async () => {
    const mockClient = {
      call: vi.fn()
        .mockResolvedValueOnce({
          persona: 'A', behavior_executed: 'x', time_simulated: '1s',
          overall_verdict: 'ok', findings: [],
        })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          persona: 'C', behavior_executed: 'x', time_simulated: '1s',
          overall_verdict: 'ok', findings: [],
        }),
    };

    const personas = [
      { name: 'A', behavior: 'a', focus: [], stops_when: 'x' },
      { name: 'B', behavior: 'b', focus: [], stops_when: 'x' },
      { name: 'C', behavior: 'c', focus: [], stops_when: 'x' },
    ];

    const results = await simulateAll(mockClient, personas, 'text', MOCK_METADATA);
    expect(results).toHaveLength(2);
    expect(results.map(r => r.persona)).toEqual(['A', 'C']);
  });
});
