// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { extractContent, detectPlatform, PLATFORM_SELECTORS, GENERIC_SELECTORS } from '../src/content/extractor.js';

function mockDOM(html, hostname = 'example.com') {
  document.body.innerHTML = html;
  Object.defineProperty(window, 'location', {
    value: { hostname, href: 'https://' + hostname + '/test' },
    writable: true,
    configurable: true,
  });
}

describe('detectPlatform', () => {
  it('detects substack', () => {
    expect(detectPlatform('mysite.substack.com')).toBe('substack.com');
  });

  it('detects medium', () => {
    expect(detectPlatform('medium.com')).toBe('medium.com');
  });

  it('returns null for unknown', () => {
    expect(detectPlatform('example.com')).toBeNull();
  });
});

describe('extractContent', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('extracts from article element', () => {
    mockDOM('<article>Article text here</article>');
    const result = extractContent();
    expect(result.text).toBe('Article text here');
  });

  it('extracts from main element', () => {
    mockDOM('<main>Main content</main>');
    const result = extractContent();
    expect(result.text).toBe('Main content');
  });

  it('falls back to body.innerText', () => {
    mockDOM('<div>Fallback text</div>');
    const result = extractContent();
    expect(result.text).toContain('Fallback text');
  });
});
