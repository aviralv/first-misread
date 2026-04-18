import { describe, it, expect } from 'vitest';
import { validateInput, stripObsidianComments, stripFrontmatter } from '../src/core/pipeline.js';

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

describe('stripObsidianComments', () => {
  it('removes inline comments', () => {
    expect(stripObsidianComments('hello %%secret%% world')).toBe('hello  world');
  });

  it('removes multiline comments', () => {
    const input = 'before\n%%\nthis is hidden\nacross lines\n%%\nafter';
    expect(stripObsidianComments(input)).toBe('before\n\nafter');
  });

  it('removes multiple comments', () => {
    expect(stripObsidianComments('a %%one%% b %%two%% c')).toBe('a  b  c');
  });

  it('leaves text without comments unchanged', () => {
    expect(stripObsidianComments('no comments here')).toBe('no comments here');
  });

  it('handles empty string', () => {
    expect(stripObsidianComments('')).toBe('');
  });
});

describe('stripFrontmatter', () => {
  it('strips standard YAML frontmatter', () => {
    const input = '---\ntitle: My Post\nstatus: draft\n---\nHello world';
    expect(stripFrontmatter(input)).toBe('Hello world');
  });

  it('strips frontmatter with trailing newline after closing fence', () => {
    const input = '---\ntitle: Test\n---\n\nContent here';
    expect(stripFrontmatter(input)).toBe('\nContent here');
  });

  it('leaves text without frontmatter unchanged', () => {
    expect(stripFrontmatter('no frontmatter here')).toBe('no frontmatter here');
  });

  it('only strips frontmatter at the start of the text', () => {
    const input = 'Some text\n---\ntitle: Not frontmatter\n---\nMore text';
    expect(stripFrontmatter(input)).toBe(input);
  });

  it('handles Windows line endings', () => {
    const input = '---\r\ntitle: Test\r\n---\r\nContent';
    expect(stripFrontmatter(input)).toBe('Content');
  });

  it('handles empty string', () => {
    expect(stripFrontmatter('')).toBe('');
  });

  it('handles frontmatter with no content after', () => {
    const input = '---\ntitle: Test\n---\n';
    expect(stripFrontmatter(input)).toBe('');
  });
});

describe('validateInput strips frontmatter and comments', () => {
  it('strips frontmatter before counting words', () => {
    const frontmatter = '---\ntitle: My Post\nstatus: draft\ntags: [writing]\n---\n';
    const body = Array(100).fill('word').join(' ');
    expect(() => validateInput(frontmatter + body)).not.toThrow();
  });

  it('strips both frontmatter and Obsidian comments', () => {
    const input = '---\ntitle: Test\n---\n%%hidden%%\n' + Array(100).fill('word').join(' ');
    expect(() => validateInput(input)).not.toThrow();
  });
});
