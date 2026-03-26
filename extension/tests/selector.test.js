import { describe, it, expect, vi } from 'vitest';
import { selectDynamicPersonas } from '../src/core/selector.js';
import { getDynamicPersonas } from '../src/core/personas.js';

describe('selectDynamicPersonas', () => {
  it('returns selected personas from catalog', async () => {
    const mockClient = {
      call: vi.fn().mockResolvedValue({ dynamic_personas: ['skeptic', 'domain-outsider'] }),
    };
    const dynamic = getDynamicPersonas();
    const metadata = { wordCount: 500, estimatedReadTimeMinutes: 2.5 };

    const result = await selectDynamicPersonas(mockClient, 'some text', metadata, dynamic);

    expect(result).toHaveLength(2);
    expect(result.map(p => p.name)).toContain('The Skeptic');
    expect(result.map(p => p.name)).toContain('The Domain Outsider');
    expect(mockClient.call).toHaveBeenCalledOnce();
  });

  it('returns empty array on API failure', async () => {
    const mockClient = { call: vi.fn().mockResolvedValue(null) };
    const result = await selectDynamicPersonas(mockClient, 'text', {}, getDynamicPersonas());
    expect(result).toEqual([]);
  });

  it('skips unknown persona names', async () => {
    const mockClient = {
      call: vi.fn().mockResolvedValue({ dynamic_personas: ['skeptic', 'nonexistent'] }),
    };
    const result = await selectDynamicPersonas(mockClient, 'text', {}, getDynamicPersonas());
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('The Skeptic');
  });
});
