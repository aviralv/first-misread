import { describe, it, expect } from 'vitest';
import { aggregateFindings, passagesOverlap } from '../src/core/aggregator.js';

describe('passagesOverlap', () => {
  it('identical passages overlap', () => {
    expect(passagesOverlap('hello world', 'hello world')).toBe(true);
  });

  it('very different passages do not overlap', () => {
    expect(passagesOverlap('hello world', 'completely different text')).toBe(false);
  });

  it('is case insensitive', () => {
    expect(passagesOverlap('Hello World', 'hello world')).toBe(true);
  });
});

describe('aggregateFindings', () => {
  it('keeps non-overlapping findings separate', () => {
    const results = [
      { persona: 'A', findings: [
        { passage: 'first passage', severity: 'high', location: 'p1', what_happened: 'confused' },
      ]},
      { persona: 'B', findings: [
        { passage: 'totally different text', severity: 'low', location: 'p2', what_happened: 'bored' },
      ]},
    ];
    const agg = aggregateFindings(results);
    expect(agg).toHaveLength(2);
  });

  it('merges overlapping findings and escalates severity', () => {
    const results = [
      { persona: 'A', findings: [
        { passage: 'the same passage here', severity: 'low', location: 'p1', what_happened: 'confused' },
      ]},
      { persona: 'B', findings: [
        { passage: 'the same passage here', severity: 'high', location: 'p1', what_happened: 'lost interest' },
      ]},
    ];
    const agg = aggregateFindings(results);
    expect(agg).toHaveLength(1);
    expect(agg[0].personas).toEqual(['A', 'B']);
    expect(agg[0].severity).toBe('high');
  });

  it('sorts by severity then persona count', () => {
    const results = [
      { persona: 'A', findings: [
        { passage: 'low sev', severity: 'low', location: 'p1', what_happened: 'x' },
      ]},
      { persona: 'B', findings: [
        { passage: 'high sev', severity: 'high', location: 'p2', what_happened: 'y' },
      ]},
    ];
    const agg = aggregateFindings(results);
    expect(agg[0].severity).toBe('high');
  });
});
