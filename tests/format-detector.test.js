import { describe, it, expect } from 'vitest';
import { detectFormat, FORMAT_CALIBRATIONS } from '../src/core/format-detector.js';

const baseMetadata = {
  wordCount: 200,
  headingCount: 0,
  paragraphCount: 5,
  avgSentenceLength: 12,
  hasLists: false,
  hasLinks: false,
};

describe('detectFormat — explicit flag', () => {
  it('returns the explicit format with highest confidence', () => {
    const result = detectFormat('any text', baseMetadata, 'linkedin');
    expect(result.format).toBe('linkedin');
    expect(result.confidence).toBe('explicit');
    expect(result.source).toBe('flag');
    expect(result.calibration).toBe(FORMAT_CALIBRATIONS.linkedin);
  });

  it('throws on invalid format flag', () => {
    expect(() => detectFormat('text', baseMetadata, 'blog')).toThrow(/Unknown format "blog"/);
    expect(() => detectFormat('text', baseMetadata, 'blog')).toThrow(/linkedin/);
  });

  it('accepts all valid format names', () => {
    for (const format of Object.keys(FORMAT_CALIBRATIONS)) {
      const result = detectFormat('text', baseMetadata, format);
      expect(result.format).toBe(format);
    }
  });
});

describe('detectFormat — frontmatter detection', () => {
  it('detects platform: linkedin in frontmatter', () => {
    const text = '---\ntitle: My Post\nplatform: linkedin\nstatus: draft\n---\nSome content here.';
    const result = detectFormat(text, baseMetadata);
    expect(result.format).toBe('linkedin');
    expect(result.confidence).toBe('high');
    expect(result.source).toBe('context');
  });

  it('detects platform: twitter as tweet', () => {
    const text = '---\nplatform: twitter\n---\nShort thought.';
    const result = detectFormat(text, baseMetadata);
    expect(result.format).toBe('tweet');
  });

  it('detects platform: x as tweet', () => {
    const text = '---\nplatform: x\n---\nShort thought.';
    const result = detectFormat(text, baseMetadata);
    expect(result.format).toBe('tweet');
  });

  it('detects platform: email', () => {
    const text = '---\nplatform: email\n---\nHi there.';
    const result = detectFormat(text, baseMetadata);
    expect(result.format).toBe('email');
  });

  it('detects platform: newsletter as email', () => {
    const text = '---\nplatform: newsletter\n---\nDear readers.';
    const result = detectFormat(text, baseMetadata);
    expect(result.format).toBe('email');
  });

  it('detects platform: substack as essay', () => {
    const text = '---\nplatform: substack\n---\nLong form content.';
    const result = detectFormat(text, baseMetadata);
    expect(result.format).toBe('essay');
  });

  it('detects platform: blog as essay', () => {
    const text = '---\nplatform: blog\n---\nBlog post content.';
    const result = detectFormat(text, baseMetadata);
    expect(result.format).toBe('essay');
  });

  it('detects type: linkedin-post in frontmatter', () => {
    const text = '---\ntype: linkedin-post\n---\nContent.';
    const result = detectFormat(text, baseMetadata);
    expect(result.format).toBe('linkedin');
  });

  it('detects type: tweet in frontmatter', () => {
    const text = '---\ntype: tweet\n---\nShort.';
    const result = detectFormat(text, baseMetadata);
    expect(result.format).toBe('tweet');
  });

  it('detects type: thread as tweet', () => {
    const text = '---\ntype: thread\n---\n1/ First point.';
    const result = detectFormat(text, baseMetadata);
    expect(result.format).toBe('tweet');
  });

  it('detects type: essay', () => {
    const text = '---\ntype: essay\n---\nLong content.';
    const result = detectFormat(text, baseMetadata);
    expect(result.format).toBe('essay');
  });

  it('detects type: article as essay', () => {
    const text = '---\ntype: article\n---\nArticle content.';
    const result = detectFormat(text, baseMetadata);
    expect(result.format).toBe('essay');
  });

  it('is case-insensitive for platform/type values', () => {
    const text = '---\nplatform: LinkedIn\n---\nContent.';
    const result = detectFormat(text, baseMetadata);
    expect(result.format).toBe('linkedin');
  });

  it('handles Windows line endings in frontmatter', () => {
    const text = '---\r\nplatform: linkedin\r\n---\r\nContent.';
    const result = detectFormat(text, baseMetadata);
    expect(result.format).toBe('linkedin');
  });

  it('ignores unrecognized platform values', () => {
    const text = '---\nplatform: mastodon\n---\n' + Array(200).fill('word').join(' ');
    const result = detectFormat(text, { ...baseMetadata, wordCount: 200 });
    expect(result.source).toBe('heuristic');
  });
});

describe('detectFormat — filename detection', () => {
  it('detects linkedin from filename', () => {
    const text = 'No frontmatter, just a plain post about life.';
    const result = detectFormat(text, baseMetadata, null, { filename: '2026-05-06-activation-problem-linkedin.md' });
    expect(result.format).toBe('linkedin');
    expect(result.confidence).toBe('high');
    expect(result.source).toBe('context');
  });

  it('detects tweet from filename', () => {
    const result = detectFormat('Short thought', baseMetadata, null, { filename: 'my-tweet-draft.md' });
    expect(result.format).toBe('tweet');
  });

  it('detects thread from filename', () => {
    const result = detectFormat('Thread content', baseMetadata, null, { filename: 'thread-about-ai.md' });
    expect(result.format).toBe('tweet');
  });

  it('detects email from filename', () => {
    const result = detectFormat('Email body', baseMetadata, null, { filename: 'follow-up-email.md' });
    expect(result.format).toBe('email');
  });

  it('detects newsletter from filename', () => {
    const result = detectFormat('Newsletter issue', baseMetadata, null, { filename: 'weekly-newsletter-42.md' });
    expect(result.format).toBe('email');
  });

  it('is case-insensitive for filename matching', () => {
    const result = detectFormat('Content', baseMetadata, null, { filename: 'My-LinkedIn-Draft.md' });
    expect(result.format).toBe('linkedin');
  });

  it('frontmatter takes priority over filename', () => {
    const text = '---\nplatform: essay\n---\nContent about essays.';
    const result = detectFormat(text, baseMetadata, null, { filename: 'something-linkedin-draft.md' });
    expect(result.format).toBe('essay');
  });
});

describe('detectFormat — heuristic scoring', () => {
  it('detects LinkedIn from heuristic signals (short + hashtags + line breaks)', () => {
    const text = Array(80).fill('word').join(' ') + '\n\n' +
      Array(60).fill('thought').join(' ') + '\n\n' +
      'Closing line.\n\n#leadership #productmanagement';
    const metadata = {
      wordCount: 145,
      headingCount: 0,
      paragraphCount: 4,
      avgSentenceLength: 12,
      hasLists: false,
      hasLinks: false,
    };
    const result = detectFormat(text, metadata);
    expect(result.format).toBe('linkedin');
    expect(result.source).toBe('heuristic');
  });

  it('detects tweet from very short text', () => {
    const text = 'Hot take: the best PRD is a prototype.';
    const metadata = {
      wordCount: 8,
      headingCount: 0,
      paragraphCount: 1,
      avgSentenceLength: 8,
      hasLists: false,
      hasLinks: false,
    };
    const result = detectFormat(text, metadata);
    expect(result.format).toBe('tweet');
    expect(result.source).toBe('heuristic');
  });

  it('detects essay from long text with headings', () => {
    const text = '# Introduction\n\n' + Array(600).fill('word').join(' ') + '\n\n## Section Two\n\nMore content.';
    const metadata = {
      wordCount: 605,
      headingCount: 2,
      paragraphCount: 4,
      avgSentenceLength: 18,
      hasLists: true,
      hasLinks: false,
    };
    const result = detectFormat(text, metadata);
    expect(result.format).toBe('essay');
    expect(result.source).toBe('heuristic');
  });

  it('detects email from salutation + signoff', () => {
    const text = 'Hi Marcus,\n\nJust checking in on the status of the PR.\n\nBest regards,\nAvi';
    const metadata = {
      wordCount: 15,
      headingCount: 0,
      paragraphCount: 3,
      avgSentenceLength: 8,
      hasLists: false,
      hasLinks: false,
    };
    const result = detectFormat(text, metadata);
    expect(result.format).toBe('email');
    expect(result.source).toBe('heuristic');
  });

  it('returns confidence based on score thresholds', () => {
    const strongLinkedIn = '---\nplatform: linkedin\n---\nContent.';
    const result = detectFormat(strongLinkedIn, baseMetadata);
    expect(result.confidence).toBe('high');
  });

  it('includes signals in heuristic results', () => {
    const text = Array(200).fill('word').join(' ');
    const result = detectFormat(text, baseMetadata);
    expect(result.signals).toBeDefined();
    expect(result.signals.wordCount).toBe(200);
  });

  it('does not include signals in context-based results', () => {
    const text = '---\nplatform: linkedin\n---\nContent.';
    const result = detectFormat(text, baseMetadata);
    expect(result.signals).toBeUndefined();
  });
});

describe('detectFormat — priority order', () => {
  it('explicit flag beats frontmatter', () => {
    const text = '---\nplatform: essay\n---\nContent.';
    const result = detectFormat(text, baseMetadata, 'linkedin');
    expect(result.format).toBe('linkedin');
    expect(result.source).toBe('flag');
  });

  it('explicit flag beats filename', () => {
    const result = detectFormat('Content', baseMetadata, 'essay', { filename: 'my-linkedin-post.md' });
    expect(result.format).toBe('essay');
    expect(result.source).toBe('flag');
  });

  it('frontmatter beats filename', () => {
    const text = '---\nplatform: email\n---\nContent.';
    const result = detectFormat(text, baseMetadata, null, { filename: 'linkedin-draft.md' });
    expect(result.format).toBe('email');
    expect(result.source).toBe('context');
  });

  it('filename beats heuristics', () => {
    const longText = Array(700).fill('word').join(' ');
    const essayMeta = { ...baseMetadata, wordCount: 700, headingCount: 3 };
    const result = detectFormat(longText, essayMeta, null, { filename: 'my-linkedin-post.md' });
    expect(result.format).toBe('linkedin');
    expect(result.source).toBe('context');
  });
});

describe('FORMAT_CALIBRATIONS', () => {
  it('defines all expected formats', () => {
    expect(Object.keys(FORMAT_CALIBRATIONS)).toEqual(
      expect.arrayContaining(['linkedin', 'essay', 'email', 'tweet', 'short-form'])
    );
  });

  it('each format has required fields', () => {
    for (const [key, cal] of Object.entries(FORMAT_CALIBRATIONS)) {
      expect(cal.name).toBeDefined();
      expect(cal.description).toBeDefined();
      expect(cal.expectations).toBeDefined();
      expect(cal.expectations.hook).toBeDefined();
      expect(cal.expectations.evidence).toBeDefined();
      expect(cal.expectations.structure).toBeDefined();
      expect(cal.expectations.closing).toBeDefined();
      expect(cal.expectations.length).toBeDefined();
      expect(cal.expectations.vocabulary).toBeDefined();
    }
  });
});
