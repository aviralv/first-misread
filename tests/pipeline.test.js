import { describe, it, expect } from 'vitest';
import { validateInput } from '../src/core/pipeline.js';

describe('validateInput', () => {
  it('accepts text within word count bounds', () => {
    const text = Array(100).fill('word').join(' ');
    expect(() => validateInput(text)).not.toThrow();
  });

  it('rejects text below minimum words', () => {
    const text = 'too short';
    expect(() => validateInput(text)).toThrow(/too short/i);
  });

  it('rejects text above maximum words', () => {
    const text = Array(3000).fill('word').join(' ');
    expect(() => validateInput(text)).toThrow(/too long/i);
  });

  it('returns 0 words for empty string', () => {
    expect(() => validateInput('')).toThrow(/0 words/);
  });

  it('returns 0 words for whitespace-only string', () => {
    expect(() => validateInput('   \n  \t  ')).toThrow(/0 words/);
  });

  it('trims whitespace before counting', () => {
    const text = '  ' + Array(100).fill('word').join(' ') + '  ';
    expect(() => validateInput(text)).not.toThrow();
  });
});
