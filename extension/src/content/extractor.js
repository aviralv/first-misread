export const PLATFORM_SELECTORS = {
  'substack.com': {
    selectors: ['.ProseMirror', '.post-content', '.body.markup'],
    name: 'Substack',
  },
  'medium.com': {
    selectors: ['.section-content', 'article'],
    name: 'Medium',
  },
  'docs.google.com': {
    selectors: ['.kix-lineview'],
    name: 'Google Docs',
    extractAll: true,
  },
};

export const GENERIC_SELECTORS = [
  'article', 'main', '[role="main"]',
  '.post-content', '.entry-content', '.article-content',
];

export function detectPlatform(hostname) {
  for (const key of Object.keys(PLATFORM_SELECTORS)) {
    if (hostname.includes(key)) return key;
  }
  return null;
}

export function extractContent() {
  const hostname = window.location.hostname;
  const platform = detectPlatform(hostname);
  const url = window.location.href;

  if (platform) {
    const config = PLATFORM_SELECTORS[platform];
    for (const sel of config.selectors) {
      if (config.extractAll) {
        const els = document.querySelectorAll(sel);
        if (els.length) {
          const text = Array.from(els).map(el => el.textContent).join('\n');
          return { text: text.trim(), url, platform: config.name };
        }
      } else {
        const el = document.querySelector(sel);
        if (el) {
          return { text: (el.innerText || el.textContent).trim(), url, platform: config.name };
        }
      }
    }
  }

  for (const sel of GENERIC_SELECTORS) {
    const el = document.querySelector(sel);
    if (el) {
      return { text: (el.innerText || el.textContent).trim(), url, platform: platform ? PLATFORM_SELECTORS[platform].name : null };
    }
  }

  return { text: (document.body.innerText || document.body.textContent).trim(), url, platform: null };
}

// When injected by service worker, auto-extract and store result
if (typeof window !== 'undefined') {
  window.__firstMisreadContent = extractContent();
}
