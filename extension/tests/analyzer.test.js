import { describe, it, expect } from 'vitest';
import { analyzeContent } from '../src/core/analyzer.js';

describe('analyzeContent', () => {
  it('counts words', () => {
    const m = analyzeContent('one two three four five');
    expect(m.wordCount).toBe(5);
  });

  it('calculates read time at 200 wpm', () => {
    const words = Array(400).fill('word').join(' ');
    const m = analyzeContent(words);
    expect(m.estimatedReadTimeMinutes).toBe(2.0);
  });

  it('counts paragraphs split by double newline', () => {
    const m = analyzeContent('First paragraph.\n\nSecond paragraph.\n\nThird.');
    expect(m.paragraphCount).toBe(3);
  });

  it('counts markdown headings', () => {
    const m = analyzeContent('# Heading 1\n\nText\n\n## Heading 2\n\nMore text');
    expect(m.headingCount).toBe(2);
  });

  it('detects lists', () => {
    expect(analyzeContent('- item one\n- item two').hasLists).toBe(true);
    expect(analyzeContent('just a sentence here').hasLists).toBe(false);
  });

  it('detects markdown links', () => {
    expect(analyzeContent('see [link](http://x.com)').hasLinks).toBe(true);
    expect(analyzeContent('no links here').hasLinks).toBe(false);
  });

  it('calculates average sentence length', () => {
    const m = analyzeContent('One two three. Four five six.');
    expect(m.sentenceCount).toBe(2);
    expect(m.avgSentenceLength).toBe(3);
  });
});
