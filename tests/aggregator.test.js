import { describe, it, expect } from 'vitest';
import { passagesOverlap, aggregateFindings } from '../src/core/aggregator.js';

describe('passagesOverlap', () => {
  it('returns true for identical passages', () => {
    expect(passagesOverlap('the cat sat on the mat', 'the cat sat on the mat')).toBe(true);
  });

  it('returns true for highly overlapping passages', () => {
    expect(passagesOverlap(
      'the cat sat on the mat',
      'the cat sat on the rug'
    )).toBe(true);
  });

  it('returns false for completely different passages', () => {
    expect(passagesOverlap(
      'the cat sat on the mat',
      'quick brown fox jumps over lazy dog'
    )).toBe(false);
  });

  it('is case insensitive', () => {
    expect(passagesOverlap('The Cat SAT', 'the cat sat')).toBe(true);
  });

  it('returns true for both empty strings', () => {
    expect(passagesOverlap('', '')).toBe(true);
  });
});

describe('aggregateFindings', () => {
  it('merges findings with overlapping passages', () => {
    const results = [
      {
        persona: 'Skeptic',
        findings: [{ passage: 'the cat sat on the mat', severity: 'high', what_happened: 'doubt' }],
      },
      {
        persona: 'Skimmer',
        findings: [{ passage: 'the cat sat on the mat', severity: 'medium', what_happened: 'skipped' }],
      },
    ];
    const agg = aggregateFindings(results);
    expect(agg).toHaveLength(1);
    expect(agg[0].personas).toEqual(['Skeptic', 'Skimmer']);
    expect(agg[0].severity).toBe('high');
  });

  it('keeps non-overlapping findings separate', () => {
    const results = [
      {
        persona: 'Skeptic',
        findings: [{ passage: 'claim without evidence', severity: 'high', what_happened: 'doubt' }],
      },
      {
        persona: 'Skimmer',
        findings: [{ passage: 'buried lede in paragraph five', severity: 'low', what_happened: 'missed' }],
      },
    ];
    const agg = aggregateFindings(results);
    expect(agg).toHaveLength(2);
  });

  it('sorts by severity then persona count', () => {
    const results = [
      {
        persona: 'A',
        findings: [
          { passage: 'the quarterly revenue forecast looks optimistic', location: 'p1', severity: 'low', what_happened: 'x' },
          { passage: 'deploying untested code directly to production servers', location: 'p2', severity: 'high', what_happened: 'y' },
        ],
      },
    ];
    const agg = aggregateFindings(results);
    expect(agg).toHaveLength(2);
    expect(agg[0].severity).toBe('high');
    expect(agg[1].severity).toBe('low');
  });

  it('handles empty results', () => {
    expect(aggregateFindings([])).toEqual([]);
  });

  it('handles personas with no findings', () => {
    const results = [{ persona: 'Happy', findings: [] }];
    expect(aggregateFindings(results)).toEqual([]);
  });
});
