import { describe, it, expect } from 'vitest';
import { identifyStrengths } from '../src/core/strengths.js';

describe('identifyStrengths', () => {
  it('returns both strengths and takeaways', async () => {
    const mockClient = {
      callCount: 0,
      async call(system, user) {
        this.callCount++;
        if (this.callCount === 1) {
          return {
            strengths: [
              { passage: 'test passage', location: 'paragraph 1', why: 'load-bearing' }
            ]
          };
        }
        return {
          takeaways: [
            { passage: 'takeaway passage', location: 'paragraph 2', takeaway: 'readers will remember this' }
          ]
        };
      }
    };

    const metadata = { wordCount: 200, paragraphCount: 5 };
    const results = [{ persona: 'Test', overall_verdict: 'ok', findings: [] }];

    const result = await identifyStrengths(mockClient, 'some text', metadata, results);

    expect(result.strengths).toHaveLength(1);
    expect(result.strengths[0].passage).toBe('test passage');
    expect(result.takeaways).toHaveLength(1);
    expect(result.takeaways[0].takeaway).toBe('readers will remember this');
  });

  it('returns empty takeaways if LLM fails', async () => {
    const mockClient = {
      callCount: 0,
      async call() {
        this.callCount++;
        if (this.callCount === 1) {
          return { strengths: [{ passage: 'p', location: 'l', why: 'w' }] };
        }
        return null;
      }
    };

    const result = await identifyStrengths(mockClient, 'text', { wordCount: 100, paragraphCount: 3 }, []);
    expect(result.strengths).toHaveLength(1);
    expect(result.takeaways).toEqual([]);
  });
});
