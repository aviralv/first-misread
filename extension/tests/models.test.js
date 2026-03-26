import { describe, it, expect } from 'vitest';
import {
  createContentMetadata,
  createFinding,
  createPersonaResult,
  createAggregatedFinding,
  signalStrength,
  computeFeedbackCounts,
} from '../src/core/models.js';

describe('createContentMetadata', () => {
  it('creates metadata with all fields', () => {
    const m = createContentMetadata({ wordCount: 500, estimatedReadTimeMinutes: 2.5,
      paragraphCount: 5, headingCount: 2, hasLists: true, hasLinks: false,
      sentenceCount: 20, avgSentenceLength: 25 });
    expect(m.wordCount).toBe(500);
    expect(m.hasLists).toBe(true);
  });
});

describe('createFinding', () => {
  it('creates a finding', () => {
    const f = createFinding({ type: 'confusion', severity: 'high', passage: 'test',
      location: 'p1', whatHappened: 'confused', whatPersonaUnderstood: 'X',
      whatAuthorLikelyMeant: 'Y' });
    expect(f.type).toBe('confusion');
    expect(f.severity).toBe('high');
  });

  it('rejects invalid type', () => {
    expect(() => createFinding({ type: 'invalid', severity: 'high', passage: 'test',
      location: 'p1', whatHappened: 'x', whatPersonaUnderstood: 'x',
      whatAuthorLikelyMeant: 'x' })).toThrow();
  });
});

describe('createAggregatedFinding', () => {
  it('defaults feedbackStatus to pending', () => {
    const f = createAggregatedFinding({
      passage: 'test', location: 'p1', severity: 'high',
      personas: ['A'], descriptions: [{ persona: 'A', what_happened: 'x' }],
    });
    expect(f.feedbackStatus).toBe('pending');
  });

  it('preserves explicit feedbackStatus', () => {
    const f = createAggregatedFinding({
      passage: 'test', location: 'p1', severity: 'high',
      personas: ['A'], descriptions: [], feedbackStatus: 'dismissed',
    });
    expect(f.feedbackStatus).toBe('dismissed');
  });
});

describe('feedbackCounts', () => {
  it('counts by status', () => {
    const findings = [
      { feedbackStatus: 'pending' },
      { feedbackStatus: 'pending' },
      { feedbackStatus: 'dismissed' },
      { feedbackStatus: 'accepted' },
    ];
    expect(computeFeedbackCounts(findings)).toEqual({ pending: 2, dismissed: 1, accepted: 1 });
  });
});

describe('signalStrength', () => {
  it('singular for 1 persona', () => {
    expect(signalStrength(['A'])).toBe('flagged by 1 persona');
  });
  it('plural for 3 personas', () => {
    expect(signalStrength(['A', 'B', 'C'])).toBe('flagged by 3 personas');
  });
});
