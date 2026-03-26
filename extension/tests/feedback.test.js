import { describe, it, expect } from 'vitest';
import {
  fingerprintFinding,
  matchFindings,
  FeedbackStore,
} from '../src/core/feedback.js';

describe('fingerprintFinding', () => {
  it('produces same fingerprint for identical findings', () => {
    const finding = {
      passage: 'The key insight here is',
      personas: ['The Scanner', 'The Skeptic'],
      descriptions: [{ what_happened: 'confused by vague claim' }],
    };
    expect(fingerprintFinding(finding)).toBe(fingerprintFinding(finding));
  });

  it('produces different fingerprints for different findings', () => {
    const a = { passage: 'First passage', personas: ['A'], descriptions: [{ what_happened: 'x' }] };
    const b = { passage: 'Totally different', personas: ['B'], descriptions: [{ what_happened: 'y' }] };
    expect(fingerprintFinding(a)).not.toBe(fingerprintFinding(b));
  });
});

describe('matchFindings', () => {
  it('matches finding with same persona and similar passage', () => {
    const oldFinding = {
      passage: 'The key insight here is that readers skim',
      personas: ['The Scanner'],
      descriptions: [{ what_happened: 'confused by vague claim' }],
    };
    const newFinding = {
      passage: 'The key insight here is that readers skim quickly',
      personas: ['The Scanner', 'The Skeptic'],
      descriptions: [{ what_happened: 'confused by vague claim' }],
    };
    expect(matchFindings(oldFinding, newFinding)).toBe(true);
  });

  it('does not match findings with no persona overlap', () => {
    const oldFinding = {
      passage: 'same passage',
      personas: ['The Scanner'],
      descriptions: [{ what_happened: 'same issue' }],
    };
    const newFinding = {
      passage: 'same passage',
      personas: ['The Skeptic'],
      descriptions: [{ what_happened: 'same issue' }],
    };
    expect(matchFindings(oldFinding, newFinding)).toBe(false);
  });

  it('does not match findings with very different passages', () => {
    const oldFinding = {
      passage: 'completely different text about dogs',
      personas: ['The Scanner'],
      descriptions: [{ what_happened: 'x' }],
    };
    const newFinding = {
      passage: 'another topic entirely about cats',
      personas: ['The Scanner'],
      descriptions: [{ what_happened: 'x' }],
    };
    expect(matchFindings(oldFinding, newFinding)).toBe(false);
  });
});

describe('FeedbackStore', () => {
  it('stores and retrieves feedback by URL', () => {
    const store = new FeedbackStore();
    const fp = 'abc123';
    store.setFeedback('https://example.com/post', fp, 'dismissed');
    expect(store.getFeedback('https://example.com/post', fp)).toBe('dismissed');
  });

  it('returns null for unknown URL', () => {
    const store = new FeedbackStore();
    expect(store.getFeedback('https://example.com/post', 'abc')).toBeNull();
  });

  it('returns null for unknown fingerprint', () => {
    const store = new FeedbackStore();
    store.setFeedback('https://example.com/post', 'abc', 'dismissed');
    expect(store.getFeedback('https://example.com/post', 'xyz')).toBeNull();
  });

  it('applies prior feedback to new findings via applyFeedback', () => {
    const store = new FeedbackStore();
    const url = 'https://example.com/post';

    const oldFinding = {
      passage: 'The key insight here is that readers skim',
      personas: ['The Scanner'],
      descriptions: [{ what_happened: 'confused by vague claim' }],
      feedbackStatus: 'pending',
    };
    const fp = fingerprintFinding(oldFinding);
    store.setFeedback(url, fp, 'dismissed');

    const newFindings = [{
      passage: 'The key insight here is that readers skim',
      personas: ['The Scanner'],
      descriptions: [{ what_happened: 'confused by vague claim' }],
      feedbackStatus: 'pending',
    }];

    const result = store.applyFeedback(url, newFindings);
    expect(result[0].feedbackStatus).toBe('dismissed');
  });
});
