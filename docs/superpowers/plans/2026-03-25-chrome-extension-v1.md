  First Misread Chrome Extension — Implementation Plan

  ▎ For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

  Goal: Build a fully client-side Chrome extension (Manifest V3) that ports the First Misread reading simulation pipeline to the browser with BYOK multi-provider LLM support.

  Architecture: Preact side panel UI communicates with a service worker via chrome.runtime.connect() ports. Service worker orchestrates the core pipeline (ported from Python to JS) and calls LLM APIs directly via fetch(). Personas bundled
  as JSON at build time. No backend.

  Tech Stack: Vite, Preact, Vitest, Chrome Extension Manifest V3, vanilla CSS

  Spec: docs/superpowers/specs/2026-03-24-chrome-extension-design.md

  Ports from: src/first_misread/ (Python CLI — models, analyzer, selector, simulator, aggregator, pipeline)

  ---
  Task 1: Project Scaffold

  Files:
  - Create: extension/package.json
  - Create: extension/vite.config.js
  - Create: extension/manifest.json
  - Create: extension/src/sidepanel/index.html
  - Create: extension/src/sidepanel/index.jsx
  - Create: extension/src/background/service-worker.js
  - Create: extension/src/content/extractor.js

  Why extension/ not first-misread-extension/: shorter, same clarity, sits next to src/ and personas/.

  - Step 1: Create package.json

  {
    "name": "first-misread-extension",
    "version": "0.1.0",
    "private": true,
    "type": "module",
    "scripts": {
      "dev": "vite build --watch",
      "build": "vite build",
      "test": "vitest run",
      "test:watch": "vitest"
    },
    "dependencies": {
      "preact": "^10.25.0"
    },
    "devDependencies": {
      "@preact/preset-vite": "^2.9.0",
      "vite": "^6.0.0",
      "vitest": "^3.0.0"
    }
  }

  - Step 2: Create vite.config.js

  import { defineConfig } from 'vite';
  import preact from '@preact/preset-vite';
  import { resolve } from 'path';

  export default defineConfig({
    plugins: [preact()],
    build: {
      outDir: 'build',
      emptyDirFirst: true,
      rollupOptions: {
        input: {
          sidepanel: resolve(__dirname, 'src/sidepanel/index.html'),
          'service-worker': resolve(__dirname, 'src/background/service-worker.js'),
          extractor: resolve(__dirname, 'src/content/extractor.js'),
        },
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: 'chunks/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
    },
  });

  - Step 3: Create manifest.json

  {
    "manifest_version": 3,
    "name": "First Misread",
    "version": "0.1.0",
    "description": "Find where your writing gets misunderstood — before a real reader does.",
    "permissions": ["sidePanel", "activeTab", "storage"],
    "side_panel": {
      "default_path": "sidepanel.html"
    },
    "background": {
      "service_worker": "service-worker.js",
      "type": "module"
    },
    "content_scripts": [],
    "action": {
      "default_title": "First Misread"
    },
    "icons": {}
  }

  Note: content_scripts is empty — we inject on demand via chrome.scripting.executeScript when the user clicks "Analyze". The side_panel.default_path points to the Vite output filename.

  - Step 4: Create stub side panel entry

  extension/src/sidepanel/index.html:
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>First Misread</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./index.jsx"></script>
  </body>
  </html>

  extension/src/sidepanel/index.jsx:
  import { render } from 'preact';

  function App() {
    return <div>First Misread</div>;
  }

  render(<App />, document.getElementById('app'));

  - Step 5: Create stub service worker

  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  - Step 6: Create stub content extractor

  // Injected on demand — extracts text from active tab
  (() => {
    // Stub — implemented in Task 6
  })();

  - Step 7: Install dependencies and verify build

  Run: cd extension && npm install && npm run build
  Expected: build/ directory created with sidepanel.html, service-worker.js, extractor.js

  - Step 8: Verify extension loads in Chrome

  Manual: Open chrome://extensions, enable Developer Mode, "Load unpacked" → select extension/build/. Click the extension icon. Side panel should open showing "First Misread".

  - Step 9: Commit

  git add extension/
  git commit -m "feat(extension): project scaffold with Vite + Preact + Manifest V3"

  ---
  Task 2: Persona JSON Bundle

  Files:
  - Create: extension/scripts/convert-personas.js
  - Create: extension/src/core/personas.js
  - Test: extension/tests/personas.test.js

  The Python CLI loads YAML at runtime. The extension bundles personas as a JS module at build time.

  - Step 1: Write the failing test

  // extension/tests/personas.test.js
  import { describe, it, expect } from 'vitest';
  import { getCorePersonas, getDynamicPersonas, getAllPersonas } from '../src/core/personas.js';

  describe('personas', () => {
    it('returns 4 core personas', () => {
      const core = getCorePersonas();
      expect(core).toHaveLength(4);
      expect(core.every(p => p.type === 'core')).toBe(true);
    });

    it('returns 5 dynamic personas', () => {
      const dynamic = getDynamicPersonas();
      expect(dynamic).toHaveLength(5);
      expect(dynamic.every(p => p.type === 'dynamic')).toBe(true);
    });

    it('every persona has required fields', () => {
      const all = getAllPersonas();
      for (const p of all) {
        expect(p).toHaveProperty('name');
        expect(p).toHaveProperty('type');
        expect(p).toHaveProperty('behavior');
        expect(p).toHaveProperty('focus');
        expect(p).toHaveProperty('stops_when');
        expect(Array.isArray(p.focus)).toBe(true);
      }
    });

    it('core personas are Scanner, Skimmer, Busy Reader, Challenger', () => {
      const names = getCorePersonas().map(p => p.name);
      expect(names).toContain('The Scanner');
      expect(names).toContain('The Skimmer');
      expect(names).toContain('The Busy Reader');
      expect(names).toContain('The Challenger');
    });
  });

  - Step 2: Run test to verify it fails

  Run: cd extension && npx vitest run tests/personas.test.js
  Expected: FAIL — module not found

  - Step 3: Write the conversion script

  // extension/scripts/convert-personas.js
  // Run: node scripts/convert-personas.js
  // Reads ../personas/**/*.yaml, writes src/core/personas.js

  import { readFileSync, writeFileSync, readdirSync } from 'fs';
  import { join, basename } from 'path';
  import { parse } from 'yaml';

  const PERSONAS_ROOT = join(import.meta.dirname, '../../personas');

  function loadDir(subdir) {
    const dir = join(PERSONAS_ROOT, subdir);
    let files;
    try {
      files = readdirSync(dir).filter(f => f.endsWith('.yaml')).sort();
    } catch {
      return [];
    }
    return files.map(f => {
      const raw = readFileSync(join(dir, f), 'utf8');
      return parse(raw);
    });
  }

  const core = loadDir('core');
  const dynamic = loadDir('dynamic');

  const output = `// Auto-generated from personas/*.yaml — do not edit manually.
  // Run: node scripts/convert-personas.js

  const CORE_PERSONAS = ${JSON.stringify(core, null, 2)};

  const DYNAMIC_PERSONAS = ${JSON.stringify(dynamic, null, 2)};

  export function getCorePersonas() {
    return CORE_PERSONAS;
  }

  export function getDynamicPersonas() {
    return DYNAMIC_PERSONAS;
  }

  export function getAllPersonas() {
    return [...CORE_PERSONAS, ...DYNAMIC_PERSONAS];
  }
  `;

  writeFileSync(join(import.meta.dirname, '../src/core/personas.js'), output);
  console.log(\`Converted \${core.length} core + \${dynamic.length} dynamic personas\`);

  Add yaml as a dev dependency: update package.json devDependencies to include "yaml": "^2.7.0".

  - Step 4: Run the conversion and then the test

  Run: cd extension && npm install && node scripts/convert-personas.js && npx vitest run tests/personas.test.js
  Expected: "Converted 4 core + 5 dynamic personas", all tests PASS

  - Step 5: Add conversion to build script

  Update package.json scripts:
  "prebuild": "node scripts/convert-personas.js",
  "predev": "node scripts/convert-personas.js"

  - Step 6: Commit

  git add extension/scripts/ extension/src/core/personas.js extension/tests/personas.test.js extension/package.json
  git commit -m "feat(extension): persona YAML to JS conversion with 9 bundled personas"

  ---
  Task 3: Data Models

  Files:
  - Create: extension/src/core/models.js
  - Test: extension/tests/models.test.js

  Plain objects with factory functions. No Pydantic — just validation at boundaries.

  - Step 1: Write the failing test

  // extension/tests/models.test.js
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

  - Step 2: Run test to verify it fails

  Run: cd extension && npx vitest run tests/models.test.js
  Expected: FAIL — module not found

  - Step 3: Implement models.js

  // extension/src/core/models.js

  const VALID_FINDING_TYPES = ['confusion', 'lost_interest', 'misread', 'skipped'];
  const VALID_SEVERITIES = ['high', 'medium', 'low'];

  export function createContentMetadata(fields) {
    return { ...fields };
  }

  export function createFinding(fields) {
    if (!VALID_FINDING_TYPES.includes(fields.type)) {
      throw new Error(`Invalid finding type: ${fields.type}`);
    }
    if (!VALID_SEVERITIES.includes(fields.severity)) {
      throw new Error(`Invalid severity: ${fields.severity}`);
    }
    return { ...fields };
  }

  export function createPersonaResult(fields) {
    return {
      ...fields,
      findings: (fields.findings || []).map(createFinding),
    };
  }

  export function createAggregatedFinding(fields) {
    return { feedbackStatus: 'pending', ...fields };
  }

  export function computeFeedbackCounts(findings) {
    const counts = { pending: 0, dismissed: 0, accepted: 0 };
    for (const f of findings) {
      counts[f.feedbackStatus] = (counts[f.feedbackStatus] || 0) + 1;
    }
    return counts;
  }

  export function signalStrength(personas) {
    const n = personas.length;
    return `flagged by ${n} persona${n !== 1 ? 's' : ''}`;
  }

  - Step 4: Run test to verify it passes

  Run: cd extension && npx vitest run tests/models.test.js
  Expected: PASS

  - Step 5: Commit

  git add extension/src/core/models.js extension/tests/models.test.js
  git commit -m "feat(extension): data models with validation"

  ---
  Task 4: Content Analyzer

  Files:
  - Create: extension/src/core/analyzer.js
  - Test: extension/tests/analyzer.test.js

  Direct port of src/first_misread/analyzer.py. Pure functions, no LLM.

  - Step 1: Write the failing test

  // extension/tests/analyzer.test.js
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

  - Step 2: Run test to verify it fails

  Run: cd extension && npx vitest run tests/analyzer.test.js
  Expected: FAIL

  - Step 3: Implement analyzer.js

  // extension/src/core/analyzer.js

  const WORDS_PER_MINUTE = 200;

  export function analyzeContent(text) {
    const words = text.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const readTime = Math.round((wordCount / WORDS_PER_MINUTE) * 10) / 10;

    const paragraphs = text.split(/\n\n/).filter(p => p.trim());
    const headings = text.match(/^#{1,6}\s+.+$/gm) || [];

    const sentences = text.split(/[.!?]+\s+/).filter(s => s.trim());
    const sentenceCount = sentences.length;
    const avgSentenceLength = sentenceCount
      ? Math.round(sentences.reduce((sum, s) => sum + s.split(/\s+/).filter(Boolean).length, 0) / sentenceCount)
      : 0;

    const hasLists = /^[\s]*[-*]\s+/m.test(text);
    const hasLinks = /\[.+?\]\(.+?\)/.test(text);

    return {
      wordCount,
      estimatedReadTimeMinutes: readTime,
      paragraphCount: paragraphs.length,
      headingCount: headings.length,
      hasLists,
      hasLinks,
      sentenceCount,
      avgSentenceLength,
    };
  }

  - Step 4: Run test to verify it passes

  Run: cd extension && npx vitest run tests/analyzer.test.js
  Expected: PASS

  - Step 5: Commit

  git add extension/src/core/analyzer.js extension/tests/analyzer.test.js
  git commit -m "feat(extension): content analyzer (port from Python)"

  ---
  Task 5: LLM Client Abstraction

  Files:
  - Create: extension/src/core/llm-client.js
  - Test: extension/tests/llm-client.test.js

  Multi-provider LLM client. Uses fetch() directly. Anthropic, OpenAI, and OpenAI-compatible (covers Google).

  - Step 1: Write the failing test

  // extension/tests/llm-client.test.js
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { createClient, AnthropicClient, OpenAIClient, OpenAICompatibleClient } from '../src/core/llm-client.js';

  describe('AnthropicClient', () => {
    beforeEach(() => { vi.restoreAllMocks(); });

    it('sends correct request format', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: '{"result": "ok"}' }],
        }),
      }));

      const client = new AnthropicClient('test-key', 'claude-sonnet-4-6');
      const result = await client.call('system prompt', 'user prompt');

      expect(fetch).toHaveBeenCalledOnce();
      const [url, opts] = fetch.mock.calls[0];
      expect(url).toBe('https://api.anthropic.com/v1/messages');
      expect(opts.headers['x-api-key']).toBe('test-key');
      const body = JSON.parse(opts.body);
      expect(body.system).toBe('system prompt');
      expect(body.messages[0].content).toBe('user prompt');
      expect(result).toEqual({ result: 'ok' });
    });

    it('strips code fences from response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: '```json\n{"result": "ok"}\n```' }],
        }),
      }));

      const client = new AnthropicClient('key', 'model');
      const result = await client.call('sys', 'usr');
      expect(result).toEqual({ result: 'ok' });
    });

    it('returns null on invalid JSON', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ content: [{ text: 'not json' }] }),
      }));

      const client = new AnthropicClient('key', 'model');
      expect(await client.call('sys', 'usr')).toBeNull();
    });

    it('returns null on network error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
      const client = new AnthropicClient('key', 'model');
      expect(await client.call('sys', 'usr')).toBeNull();
    });
  });

  describe('OpenAIClient', () => {
    it('sends correct request format', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: '{"result": "ok"}' } }],
        }),
      }));

      const client = new OpenAIClient('test-key', 'gpt-4o');
      const result = await client.call('system prompt', 'user prompt');

      const [url, opts] = fetch.mock.calls[0];
      expect(url).toBe('https://api.openai.com/v1/chat/completions');
      expect(opts.headers['Authorization']).toBe('Bearer test-key');
      const body = JSON.parse(opts.body);
      expect(body.messages[0]).toEqual({ role: 'system', content: 'system prompt' });
      expect(body.messages[1]).toEqual({ role: 'user', content: 'user prompt' });
      expect(result).toEqual({ result: 'ok' });
    });
  });

  describe('createClient factory', () => {
    it('creates AnthropicClient', () => {
      const c = createClient('anthropic', { apiKey: 'k', model: 'm' });
      expect(c).toBeInstanceOf(AnthropicClient);
    });

    it('creates OpenAIClient', () => {
      const c = createClient('openai', { apiKey: 'k', model: 'm' });
      expect(c).toBeInstanceOf(OpenAIClient);
    });

    it('creates OpenAICompatibleClient for google', () => {
      const c = createClient('google', { apiKey: 'k', model: 'm' });
      expect(c).toBeInstanceOf(OpenAICompatibleClient);
    });

    it('creates OpenAICompatibleClient for openai-compatible', () => {
      const c = createClient('openai-compatible', { apiKey: 'k', model: 'm', baseUrl: 'http://localhost:1234' });
      expect(c).toBeInstanceOf(OpenAICompatibleClient);
    });
  });

  - Step 2: Run test to verify it fails

  Run: cd extension && npx vitest run tests/llm-client.test.js
  Expected: FAIL

  - Step 3: Implement llm-client.js

  // extension/src/core/llm-client.js

  function stripCodeFences(text) {
    text = text.trim();
    if (text.startsWith('```')) {
      const lines = text.split('\n');
      lines.shift();
      if (lines.length && lines[lines.length - 1].trim() === '```') {
        lines.pop();
      }
      text = lines.join('\n').trim();
    }
    return text;
  }

  function parseJSON(text) {
    try {
      return JSON.parse(stripCodeFences(text));
    } catch {
      return null;
    }
  }

  export class AnthropicClient {
    constructor(apiKey, model, baseUrl) {
      this.apiKey = apiKey;
      this.model = model || 'claude-sonnet-4-6';
      this.baseUrl = baseUrl || 'https://api.anthropic.com';
    }

    async call(system, user, maxTokens = 4096) {
      try {
        const res = await fetch(`${this.baseUrl}/v1/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: this.model,
            max_tokens: maxTokens,
            system,
            messages: [{ role: 'user', content: user }],
          }),
        });
        if (!res.ok) {
          const err = await res.text();
          throw new Error(`Anthropic API ${res.status}: ${err}`);
        }
        const data = await res.json();
        return parseJSON(data.content[0].text);
      } catch (e) {
        console.warn('AnthropicClient error:', e.message);
        return null;
      }
    }
  }

  export class OpenAIClient {
    constructor(apiKey, model, baseUrl) {
      this.apiKey = apiKey;
      this.model = model || 'gpt-4o';
      this.baseUrl = baseUrl || 'https://api.openai.com';
    }

    async call(system, user, maxTokens = 4096) {
      try {
        const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            max_tokens: maxTokens,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
          }),
        });
        if (!res.ok) {
          const err = await res.text();
          throw new Error(`OpenAI API ${res.status}: ${err}`);
        }
        const data = await res.json();
        return parseJSON(data.choices[0].message.content);
      } catch (e) {
        console.warn('OpenAIClient error:', e.message);
        return null;
      }
    }
  }

  export class OpenAICompatibleClient extends OpenAIClient {
    constructor(baseUrl, apiKey, model) {
      super(apiKey || '', model || 'default', baseUrl);
    }
  }

  export function createClient(provider, config) {
    switch (provider) {
      case 'anthropic':
        return new AnthropicClient(config.apiKey, config.model, config.baseUrl);
      case 'openai':
        return new OpenAIClient(config.apiKey, config.model, config.baseUrl);
      case 'google':
        return new OpenAICompatibleClient(
          config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta/openai',
          config.apiKey, config.model,
        );
      case 'openai-compatible':
        return new OpenAICompatibleClient(config.baseUrl, config.apiKey, config.model);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  - Step 4: Run test to verify it passes

  Run: cd extension && npx vitest run tests/llm-client.test.js
  Expected: PASS

  - Step 5: Commit

  git add extension/src/core/llm-client.js extension/tests/llm-client.test.js
  git commit -m "feat(extension): multi-provider LLM client (Anthropic, OpenAI, Google, compatible)"

  ---
  Task 6: Content Extractor

  Files:
  - Modify: extension/src/content/extractor.js
  - Test: extension/tests/extractor.test.js

  Injected into the active tab on demand. Extracts text using platform-specific selectors.

  - Step 1: Write the failing test

  // extension/tests/extractor.test.js
  import { describe, it, expect, beforeEach } from 'vitest';
  import { extractContent, detectPlatform, PLATFORM_SELECTORS, GENERIC_SELECTORS } from '../src/content/extractor.js';

  function mockDOM(html, hostname = 'example.com') {
    document.body.innerHTML = html;
    Object.defineProperty(window, 'location', {
      value: { hostname },
      writable: true,
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

  - Step 2: Run test to verify it fails

  Run: cd extension && npx vitest run tests/extractor.test.js
  Expected: FAIL

  - Step 3: Implement extractor.js

  // extension/src/content/extractor.js

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
            return { text: el.innerText.trim(), url, platform: config.name };
          }
        }
      }
    }

    for (const sel of GENERIC_SELECTORS) {
      const el = document.querySelector(sel);
      if (el) {
        return { text: el.innerText.trim(), url, platform: platform ? PLATFORM_SELECTORS[platform].name : null };
      }
    }

    return { text: document.body.innerText.trim(), url, platform: null };
  }

  - Step 4: Run test to verify it passes

  Run: cd extension && npx vitest run tests/extractor.test.js
  Expected: PASS

  - Step 5: Commit

  git add extension/src/content/extractor.js extension/tests/extractor.test.js
  git commit -m "feat(extension): content extractor with platform-specific selectors"

  ---
  Task 7: Persona Selector

  Files:
  - Create: extension/src/core/selector.js
  - Test: extension/tests/selector.test.js

  Port of src/first_misread/selector.py. One LLM call to pick 1-3 dynamic personas.

  - Step 1: Write the failing test

  // extension/tests/selector.test.js
  import { describe, it, expect, vi } from 'vitest';
  import { selectDynamicPersonas } from '../src/core/selector.js';
  import { getDynamicPersonas } from '../src/core/personas.js';

  describe('selectDynamicPersonas', () => {
    it('returns selected personas from catalog', async () => {
      const mockClient = {
        call: vi.fn().mockResolvedValue({ dynamic_personas: ['skeptic', 'domain-outsider'] }),
      };
      const dynamic = getDynamicPersonas();
      const metadata = { wordCount: 500, estimatedReadTimeMinutes: 2.5 };

      const result = await selectDynamicPersonas(mockClient, 'some text', metadata, dynamic);

      expect(result).toHaveLength(2);
      expect(result.map(p => p.name)).toContain('The Skeptic');
      expect(result.map(p => p.name)).toContain('The Domain Outsider');
      expect(mockClient.call).toHaveBeenCalledOnce();
    });

    it('returns empty array on API failure', async () => {
      const mockClient = { call: vi.fn().mockResolvedValue(null) };
      const result = await selectDynamicPersonas(mockClient, 'text', {}, getDynamicPersonas());
      expect(result).toEqual([]);
    });

    it('skips unknown persona names', async () => {
      const mockClient = {
        call: vi.fn().mockResolvedValue({ dynamic_personas: ['skeptic', 'nonexistent'] }),
      };
      const result = await selectDynamicPersonas(mockClient, 'text', {}, getDynamicPersonas());
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('The Skeptic');
    });
  });

  - Step 2: Run test to verify it fails

  Run: cd extension && npx vitest run tests/selector.test.js
  Expected: FAIL

  - Step 3: Implement selector.js

  // extension/src/core/selector.js

  const SELECTOR_SYSTEM_PROMPT = `You select which additional reader personas should review a piece of writing.

  You'll receive the text, its structural metadata, and a catalog of available dynamic personas.

  Based on the content's characteristics (metaphor-heavy, claim-heavy, jargon-dense, personal stories, etc.), pick 1-3 personas most likely to surface misread risks.

  Return JSON: {"dynamic_personas": ["filename-without-extension", ...]}
  Only use filenames from the provided catalog.`;

  export function buildCatalog(dynamicPersonas) {
    const catalog = {};
    for (const p of dynamicPersonas) {
      const key = p.name.toLowerCase().replace('the ', '').replaceAll(' ', '-');
      catalog[key] = p;
    }
    return catalog;
  }

  export async function selectDynamicPersonas(client, text, metadata, availableDynamic) {
    const catalog = buildCatalog(availableDynamic);
    const catalogDesc = Object.entries(catalog)
      .map(([key, p]) => `- ${key}: ${p.name} — ${p.behavior.trim().slice(0, 100)}`)
      .join('\n');

    const metadataJson = JSON.stringify(metadata, null, 2);

    const userPrompt = `## Content to analyze

  ${text}

  ## Structural metadata

  ${metadataJson}

  ## Available dynamic personas

  ${catalogDesc}

  Select 1-3 personas. Return JSON: {"dynamic_personas": ["name", ...]}`;

    const result = await client.call(SELECTOR_SYSTEM_PROMPT, userPrompt);

    if (!result || !result.dynamic_personas) {
      return [];
    }

    const selected = [];
    for (const name of result.dynamic_personas) {
      if (catalog[name]) {
        selected.push(catalog[name]);
      }
    }
    return selected;
  }

  - Step 4: Run test to verify it passes

  Run: cd extension && npx vitest run tests/selector.test.js
  Expected: PASS

  - Step 5: Commit

  git add extension/src/core/selector.js extension/tests/selector.test.js
  git commit -m "feat(extension): persona selector (port from Python)"

  ---
  Task 8: Reading Simulator

  Files:
  - Create: extension/src/core/simulator.js
  - Test: extension/tests/simulator.test.js

  Port of src/first_misread/simulator.py. Parallel persona simulations with Promise.allSettled.

  - Step 1: Write the failing test

  // extension/tests/simulator.test.js
  import { describe, it, expect, vi } from 'vitest';
  import { simulatePersona, simulateAll } from '../src/core/simulator.js';

  const MOCK_PERSONA = {
    name: 'The Scanner', behavior: 'Scans quickly', focus: ['headlines'], stops_when: 'bored',
  };
  const MOCK_METADATA = { wordCount: 100, estimatedReadTimeMinutes: 0.5, paragraphCount: 2, headingCount: 1 };

  describe('simulatePersona', () => {
    it('returns persona result on success', async () => {
      const mockClient = {
        call: vi.fn().mockResolvedValue({
          persona: 'The Scanner',
          behavior_executed: 'Scanned',
          time_simulated: '30s',
          overall_verdict: 'Fine',
          findings: [],
        }),
      };

      const result = await simulatePersona(mockClient, MOCK_PERSONA, 'text', MOCK_METADATA);
      expect(result.persona).toBe('The Scanner');
      expect(result.findings).toEqual([]);
    });

    it('returns null on API failure', async () => {
      const mockClient = { call: vi.fn().mockResolvedValue(null) };
      const result = await simulatePersona(mockClient, MOCK_PERSONA, 'text', MOCK_METADATA);
      expect(result).toBeNull();
    });
  });

  describe('simulateAll', () => {
    it('runs personas in parallel and filters nulls', async () => {
      const mockClient = {
        call: vi.fn()
          .mockResolvedValueOnce({
            persona: 'A', behavior_executed: 'x', time_simulated: '1s',
            overall_verdict: 'ok', findings: [],
          })
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            persona: 'C', behavior_executed: 'x', time_simulated: '1s',
            overall_verdict: 'ok', findings: [],
          }),
      };

      const personas = [
        { name: 'A', behavior: 'a', focus: [], stops_when: 'x' },
        { name: 'B', behavior: 'b', focus: [], stops_when: 'x' },
        { name: 'C', behavior: 'c', focus: [], stops_when: 'x' },
      ];

      const results = await simulateAll(mockClient, personas, 'text', MOCK_METADATA);
      expect(results).toHaveLength(2);
      expect(results.map(r => r.persona)).toEqual(['A', 'C']);
    });
  });

  - Step 2: Run test to verify it fails

  Run: cd extension && npx vitest run tests/simulator.test.js
  Expected: FAIL

  - Step 3: Implement simulator.js

  // extension/src/core/simulator.js

  const SIMULATION_SYSTEM_PROMPT = `You are simulating a specific reader persona. Read the text below exactly as this persona would — follow their behavior, focus on what they focus on, stop when they'd stop.

  Return your findings as JSON with this exact structure:
  {
    "persona": "Persona Name",
    "behavior_executed": "What you actually did while reading",
    "time_simulated": "How long this persona would spend",
    "overall_verdict": "One-sentence summary of this persona's experience",
    "findings": [
      {
        "type": "confusion | lost_interest | misread | skipped",
        "severity": "high | medium | low",
        "passage": "The exact text that caused the issue",
        "location": "paragraph N, sentence N",
        "what_happened": "Description of the problem",
        "what_persona_understood": "What the persona took away",
        "what_author_likely_meant": "What the author probably intended"
      }
    ]
  }

  If this persona would have no issues, return an empty findings array. Be honest — don't invent problems that wouldn't occur for this reading behavior.`;

  export async function simulatePersona(client, persona, text, metadata) {
    const userPrompt = `## Persona: ${persona.name}

  **Behavior:** ${persona.behavior}

  **Focus areas:** ${persona.focus.join(', ')}

  **Stops when:** ${persona.stops_when}

  ## Content metadata
  Word count: ${metadata.wordCount} | Read time: ${metadata.estimatedReadTimeMinutes} min
  Paragraphs: ${metadata.paragraphCount} | Headings: ${metadata.headingCount}

  ## Text to read

  ${text}`;

    const result = await client.call(SIMULATION_SYSTEM_PROMPT, userPrompt);
    if (!result) return null;

    if (!result.persona || !Array.isArray(result.findings)) {
      return null;
    }

    return result;
  }

  export async function simulateAll(client, personas, text, metadata, onProgress) {
    const promises = personas.map(async (persona) => {
      if (onProgress) onProgress({ type: 'persona-started', persona: persona.name });
      const result = await simulatePersona(client, persona, text, metadata);
      if (onProgress && result) {
        onProgress({ type: 'persona-done', persona: persona.name, findingCount: result.findings.length });
      }
      return result;
    });

    const settled = await Promise.allSettled(promises);

    const results = [];
    for (const outcome of settled) {
      if (outcome.status === 'fulfilled' && outcome.value) {
        results.push(outcome.value);
      }
    }
    return results;
  }

  - Step 4: Run test to verify it passes

  Run: cd extension && npx vitest run tests/simulator.test.js
  Expected: PASS

  - Step 5: Commit

  git add extension/src/core/simulator.js extension/tests/simulator.test.js
  git commit -m "feat(extension): reading simulator with parallel execution (port from Python)"

  ---
  Task 9: Aggregator

  Files:
  - Create: extension/src/core/aggregator.js
  - Test: extension/tests/aggregator.test.js

  Port of src/first_misread/aggregator.py. Uses simple token overlap instead of SequenceMatcher.

  - Step 1: Write the failing test

  // extension/tests/aggregator.test.js
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

  - Step 2: Run test to verify it fails

  Run: cd extension && npx vitest run tests/aggregator.test.js
  Expected: FAIL

  - Step 3: Implement aggregator.js

  // extension/src/core/aggregator.js

  import { signalStrength } from './models.js';

  const OVERLAP_THRESHOLD = 0.6;
  const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };

  /**
   * Simple token-overlap ratio. Counts shared unique tokens / total unique tokens.
   * Lighter than SequenceMatcher, good enough for passage dedup.
   */
  export function passagesOverlap(a, b) {
    const tokensA = new Set(a.toLowerCase().split(/\s+/));
    const tokensB = new Set(b.toLowerCase().split(/\s+/));
    const union = new Set([...tokensA, ...tokensB]);
    if (union.size === 0) return true;
    let intersection = 0;
    for (const t of tokensA) {
      if (tokensB.has(t)) intersection++;
    }
    const ratio = (2 * intersection) / (tokensA.size + tokensB.size);
    return ratio >= OVERLAP_THRESHOLD;
  }

  function highestSeverity(...severities) {
    return severities.reduce((a, b) =>
      (SEVERITY_ORDER[a] ?? 99) <= (SEVERITY_ORDER[b] ?? 99) ? a : b
    );
  }

  export function aggregateFindings(results) {
    const aggregated = [];

    for (const result of results) {
      for (const finding of result.findings) {
        let merged = false;
        for (const agg of aggregated) {
          if (passagesOverlap(finding.passage, agg.passage)) {
            agg.personas.push(result.persona);
            agg.descriptions.push({
              persona: result.persona,
              what_happened: finding.what_happened,
            });
            agg.severity = highestSeverity(agg.severity, finding.severity);
            merged = true;
            break;
          }
        }
        if (!merged) {
          aggregated.push({
            passage: finding.passage,
            location: finding.location,
            severity: finding.severity,
            personas: [result.persona],
            descriptions: [{
              persona: result.persona,
              what_happened: finding.what_happened,
            }],
          });
        }
      }
    }

    aggregated.sort((a, b) => {
      const sevDiff = (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99);
      if (sevDiff !== 0) return sevDiff;
      return b.personas.length - a.personas.length;
    });

    return aggregated;
  }

  - Step 4: Run test to verify it passes

  Run: cd extension && npx vitest run tests/aggregator.test.js
  Expected: PASS

  - Step 5: Commit

  git add extension/src/core/aggregator.js extension/tests/aggregator.test.js
  git commit -m "feat(extension): finding aggregator with token-overlap dedup (port from Python)"

  ---
  Task 10: Feedback State Manager

  Files:
  - Create: extension/src/core/feedback.js
  - Test: extension/tests/feedback.test.js

  Fingerprinting, matching, and in-memory storage for finding feedback (dismiss/accept).
  Page-scoped persistence: state is keyed by URL origin+pathname, held in memory, lost when tab closes.
  See spec section "Feedback Interaction Model" for full design.

  - Step 1: Write the failing test

  // extension/tests/feedback.test.js
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

  - Step 2: Run test to verify it fails

  Run: cd extension && npx vitest run tests/feedback.test.js
  Expected: FAIL — module not found

  - Step 3: Implement feedback.js

  // extension/src/core/feedback.js

  import { passagesOverlap } from './aggregator.js';

  /**
   * Generate a fingerprint for a finding based on persona names + passage prefix + description prefix.
   * Used for matching across re-runs, not exact equality.
   */
  export function fingerprintFinding(finding) {
    const personas = [...finding.personas].sort().join(',');
    const passage = finding.passage.toLowerCase().slice(0, 80);
    const desc = (finding.descriptions[0]?.what_happened || '').toLowerCase().slice(0, 60);
    return `${personas}|${passage}|${desc}`;
  }

  /**
   * Check if two findings match across re-runs per spec rules:
   * 1. At least one persona in common
   * 2. Passage token overlap > 0.5
   * 3. Description token overlap > 0.6
   */
  export function matchFindings(oldFinding, newFinding) {
    const personaOverlap = oldFinding.personas.some(p => newFinding.personas.includes(p));
    if (!personaOverlap) return false;

    if (!passagesOverlap(oldFinding.passage, newFinding.passage)) return false;

    const oldDesc = oldFinding.descriptions.map(d => d.what_happened).join(' ');
    const newDesc = newFinding.descriptions.map(d => d.what_happened).join(' ');
    if (!passagesOverlap(oldDesc, newDesc)) return false;

    return true;
  }

  /**
   * In-memory feedback state, keyed by URL origin+pathname.
   * Not persisted to chrome.storage — dies when service worker restarts.
   */
  export class FeedbackStore {
    constructor() {
      this.state = new Map();
    }

    _urlKey(url) {
      try {
        const u = new URL(url);
        return u.origin + u.pathname;
      } catch {
        return url;
      }
    }

    setFeedback(url, fingerprint, status) {
      const key = this._urlKey(url);
      if (!this.state.has(key)) this.state.set(key, new Map());
      this.state.get(key).set(fingerprint, { status, timestamp: Date.now() });
    }

    getFeedback(url, fingerprint) {
      const key = this._urlKey(url);
      const page = this.state.get(key);
      if (!page) return null;
      const entry = page.get(fingerprint);
      return entry ? entry.status : null;
    }

    /**
     * Apply stored feedback to new findings from a re-run.
     * For each new finding, check if any stored finding matches via matchFindings.
     * If so, carry forward the feedback status.
     */
    applyFeedback(url, newFindings) {
      const key = this._urlKey(url);
      const page = this.state.get(key);
      if (!page) return newFindings;

      const storedEntries = [...page.entries()];

      return newFindings.map(finding => {
        for (const [fp, entry] of storedEntries) {
          const stored = this._findingFromFingerprint(fp);
          if (stored && matchFindings(stored, finding)) {
            return { ...finding, feedbackStatus: entry.status };
          }
        }
        return finding;
      });
    }

    /**
     * Store all current findings for a URL (for re-run matching later).
     */
    storeFindings(url, findings) {
      for (const f of findings) {
        if (f.feedbackStatus !== 'pending') {
          this.setFeedback(url, fingerprintFinding(f), f.feedbackStatus);
        }
      }
    }

    /**
     * Reconstruct a minimal finding shape from a fingerprint for matching.
     * Fingerprint format: "persona1,persona2|passage|description"
     */
    _findingFromFingerprint(fp) {
      const parts = fp.split('|');
      if (parts.length < 3) return null;
      return {
        personas: parts[0].split(','),
        passage: parts[1],
        descriptions: [{ what_happened: parts[2] }],
      };
    }
  }

  - Step 4: Run test to verify it passes

  Run: cd extension && npx vitest run tests/feedback.test.js
  Expected: PASS

  - Step 5: Commit

  git add extension/src/core/feedback.js extension/tests/feedback.test.js
  git commit -m "feat(extension): feedback state manager with fingerprinting and cross-run matching"

  ---
  Task 11: Pipeline Orchestrator

  Files:
  - Create: extension/src/core/pipeline.js
  - Test: extension/tests/pipeline.test.js

  Port of src/first_misread/pipeline.py. Emits progress events via callback instead of returning a final result.

  - Step 1: Write the failing test

  // extension/tests/pipeline.test.js
  import { describe, it, expect, vi } from 'vitest';
  import { runPipeline, validateInput } from '../src/core/pipeline.js';

  describe('validateInput', () => {
    it('rejects text under 50 words', () => {
      const short = Array(49).fill('word').join(' ');
      expect(() => validateInput(short)).toThrow(/too short/i);
    });

    it('rejects text over 2500 words', () => {
      const long = Array(2501).fill('word').join(' ');
      expect(() => validateInput(long)).toThrow(/too long/i);
    });

    it('accepts text at boundaries', () => {
      expect(() => validateInput(Array(50).fill('word').join(' '))).not.toThrow();
      expect(() => validateInput(Array(2500).fill('word').join(' '))).not.toThrow();
    });
  });

  describe('runPipeline', () => {
    it('runs full pipeline with mocked client and emits progress', async () => {
      const events = [];
      const mockClient = {
        call: vi.fn()
          .mockResolvedValueOnce({ dynamic_personas: ['skeptic'] })
          .mockResolvedValue({
            persona: 'Test',
            behavior_executed: 'tested',
            time_simulated: '1s',
            overall_verdict: 'ok',
            findings: [],
          }),
      };

      const text = Array(100).fill('word').join(' ');
      const result = await runPipeline(mockClient, text, (e) => events.push(e));

      expect(result.metadata.wordCount).toBe(100);
      expect(Array.isArray(result.personaResults)).toBe(true);
      expect(Array.isArray(result.aggregatedFindings)).toBe(true);
      expect(events.some(e => e.type === 'metadata')).toBe(true);
      expect(events.some(e => e.type === 'personas-selected')).toBe(true);
    });
  });

  - Step 2: Run test to verify it fails

  Run: cd extension && npx vitest run tests/pipeline.test.js
  Expected: FAIL

  - Step 3: Implement pipeline.js

  // extension/src/core/pipeline.js

  import { analyzeContent } from './analyzer.js';
  import { getCorePersonas, getDynamicPersonas } from './personas.js';
  import { selectDynamicPersonas } from './selector.js';
  import { simulateAll } from './simulator.js';
  import { aggregateFindings } from './aggregator.js';

  const MIN_WORDS = 50;
  const MAX_WORDS = 2500;

  export function validateInput(text) {
    text = text.trim();
    const wordCount = text.split(/\s+/).length;
    if (wordCount < MIN_WORDS) {
      throw new Error(`Input too short: ${wordCount} words (minimum ${MIN_WORDS})`);
    }
    if (wordCount > MAX_WORDS) {
      throw new Error(`Input too long: ${wordCount} words (maximum ${MAX_WORDS})`);
    }
    return text;
  }

  export async function runPipeline(client, text, onProgress) {
    const emit = onProgress || (() => {});

    text = validateInput(text);

    const metadata = analyzeContent(text);
    emit({ type: 'metadata', metadata });

    const core = getCorePersonas();
    const dynamic = getDynamicPersonas();
    const selectedDynamic = await selectDynamicPersonas(client, text, metadata, dynamic);
    const allPersonas = [...core, ...selectedDynamic];

    emit({
      type: 'personas-selected',
      personas: allPersonas.map(p => p.name),
    });

    const personaResults = await simulateAll(client, allPersonas, text, metadata, emit);
    const aggregatedFindings = aggregateFindings(personaResults);

    emit({ type: 'complete' });

    return {
      metadata,
      personas: allPersonas,
      personaResults,
      aggregatedFindings,
    };
  }

  - Step 4: Run test to verify it passes

  Run: cd extension && npx vitest run tests/pipeline.test.js
  Expected: PASS

  - Step 5: Commit

  git add extension/src/core/pipeline.js extension/tests/pipeline.test.js
  git commit -m "feat(extension): pipeline orchestrator with progress events (port from Python)"

  ---
  Task 12: Storage Layer

  Files:
  - Create: extension/src/shared/storage.js
  - Test: extension/tests/storage.test.js

  Wraps chrome.storage.local with typed getters/setters. For tests, provides an in-memory mock.

  - Step 1: Write the failing test

  // extension/tests/storage.test.js
  import { describe, it, expect, beforeEach, vi } from 'vitest';
  import { getSettings, saveSettings, isOnboardingComplete, completeOnboarding } from '../src/shared/storage.js';

  const mockStorage = {};

  beforeEach(() => {
    Object.keys(mockStorage).length && Object.keys(mockStorage).forEach(k => delete mockStorage[k]);

    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: vi.fn((keys) => Promise.resolve(
            Array.isArray(keys)
              ? Object.fromEntries(keys.map(k => [k, mockStorage[k]]))
              : { [keys]: mockStorage[keys] }
          )),
          set: vi.fn((obj) => {
            Object.assign(mockStorage, obj);
            return Promise.resolve();
          }),
        },
      },
    });
  });

  describe('settings', () => {
    it('saves and retrieves settings', async () => {
      await saveSettings({ provider: 'anthropic', apiKey: 'sk-test', model: 'claude-sonnet-4-6' });
      const settings = await getSettings();
      expect(settings.provider).toBe('anthropic');
      expect(settings.apiKey).toBe('sk-test');
    });
  });

  describe('onboarding', () => {
    it('returns false before completion', async () => {
      expect(await isOnboardingComplete()).toBe(false);
    });

    it('returns true after completion', async () => {
      await completeOnboarding();
      expect(await isOnboardingComplete()).toBe(true);
    });
  });

  - Step 2: Run test to verify it fails

  Run: cd extension && npx vitest run tests/storage.test.js
  Expected: FAIL

  - Step 3: Implement storage.js

  // extension/src/shared/storage.js

  export async function getSettings() {
    const result = await chrome.storage.local.get([
      'provider', 'apiKey', 'baseUrl', 'model', 'onboardingComplete', 'preferences',
    ]);
    return {
      provider: result.provider || null,
      apiKey: result.apiKey || null,
      baseUrl: result.baseUrl || null,
      model: result.model || null,
      onboardingComplete: result.onboardingComplete || false,
      preferences: result.preferences || { includeRewrites: false },
    };
  }

  export async function saveSettings(settings) {
    await chrome.storage.local.set(settings);
  }

  export async function isOnboardingComplete() {
    const result = await chrome.storage.local.get('onboardingComplete');
    return result.onboardingComplete === true;
  }

  export async function completeOnboarding() {
    await chrome.storage.local.set({ onboardingComplete: true });
  }

  - Step 4: Run test to verify it passes

  Run: cd extension && npx vitest run tests/storage.test.js
  Expected: PASS

  - Step 5: Commit

  git add extension/src/shared/storage.js extension/tests/storage.test.js
  git commit -m "feat(extension): storage layer wrapping chrome.storage.local"

  ---
  Task 13: Service Worker (Message Router)

  Files:
  - Modify: extension/src/background/service-worker.js

  Wires up port-based messaging between side panel and content script. Orchestrates the pipeline.

  - Step 1: Implement service-worker.js

  // extension/src/background/service-worker.js

  import { getSettings } from '../shared/storage.js';
  import { createClient } from '../core/llm-client.js';
  import { runPipeline } from '../core/pipeline.js';
  import { FeedbackStore, fingerprintFinding } from '../core/feedback.js';

  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  const feedbackStore = new FeedbackStore();

  chrome.runtime.onConnect.addListener((port) => {
    port.onMessage.addListener(async (msg) => {
      if (msg.type === 'analyze-page') {
        await handleAnalyzePage(port);
      } else if (msg.type === 'analyze-text') {
        await handleAnalyzeText(port, msg.text);
      } else if (msg.type === 'feedback:update') {
        handleFeedbackUpdate(port, msg);
      }
    });
  });

  function handleFeedbackUpdate(port, msg) {
    const { url, findingFingerprint, status } = msg;
    feedbackStore.setFeedback(url, findingFingerprint, status);

    const pageFeedback = feedbackStore.state.get(feedbackStore._urlKey(url));
    const counts = { pending: 0, dismissed: 0, accepted: 0 };
    if (pageFeedback) {
      for (const entry of pageFeedback.values()) {
        counts[entry.status] = (counts[entry.status] || 0) + 1;
      }
    }
    port.postMessage({ type: 'feedback:applied', updatedCounts: counts });
  }

  async function extractFromActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('No active tab');

    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['extractor.js'],
    });

    // extractor.js sets window.__firstMisreadContent
    const [content] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.__firstMisreadContent,
    });

    return content.result;
  }

  async function handleAnalyzePage(port) {
    try {
      port.postMessage({ type: 'progress:extracting' });
      const content = await extractFromActiveTab();

      if (!content || !content.text) {
        port.postMessage({ type: 'error', message: 'Could not extract text from this page.' });
        return;
      }

      port.postMessage({ type: 'progress:extracted', platform: content.platform, url: content.url });
      await runAnalysis(port, content.text, content.url);
    } catch (e) {
      port.postMessage({ type: 'error', message: e.message });
    }
  }

  async function handleAnalyzeText(port, text) {
    try {
      await runAnalysis(port, text, null);
    } catch (e) {
      port.postMessage({ type: 'error', message: e.message });
    }
  }

  async function runAnalysis(port, text, url) {
    const settings = await getSettings();
    if (!settings.provider || !settings.apiKey) {
      port.postMessage({ type: 'error', message: 'Please configure your API key in settings.' });
      return;
    }

    const client = createClient(settings.provider, settings);

    const result = await runPipeline(client, text, (event) => {
      port.postMessage({ type: `progress:${event.type}`, ...event });
    });

    const findingsWithFeedback = url
      ? feedbackStore.applyFeedback(url, result.aggregatedFindings)
      : result.aggregatedFindings;

    port.postMessage({ type: 'results:complete', ...result, aggregatedFindings: findingsWithFeedback });
  }

  Note: This requires updating extractor.js to set window.__firstMisreadContent — add to the end of extractContent():

  - Step 2: Update extractor.js to expose result on window

  Add to the bottom of extension/src/content/extractor.js:

  // When injected by service worker, auto-extract and store result
  if (typeof window !== 'undefined') {
    window.__firstMisreadContent = extractContent();
  }

  - Step 3: Update manifest.json for scripting permission

  Add "scripting" to the permissions array in manifest.json:

  "permissions": ["sidePanel", "activeTab", "storage", "scripting"]

  - Step 4: Build and manually test extension loads

  Run: cd extension && npm run build
  Load unpacked in Chrome. Verify no console errors in the service worker.

  - Step 5: Commit

  git add extension/src/background/service-worker.js extension/src/content/extractor.js extension/manifest.json
  git commit -m "feat(extension): service worker with message routing and pipeline orchestration"

  ---
  Task 14: Onboarding UI

  Files:
  - Create: extension/src/sidepanel/components/Onboarding.jsx
  - Create: extension/src/sidepanel/styles/panel.css
  - Modify: extension/src/sidepanel/index.jsx

  5-step wizard: Welcome → Provider → API Key → Test Run → Done.

  - Step 1: Create panel.css with base styles

  /* extension/src/sidepanel/styles/panel.css */

  :root {
    --bg: #fafafa;
    --fg: #1a1a1a;
    --muted: #666;
    --border: #e0e0e0;
    --accent: #2563eb;
    --accent-hover: #1d4ed8;
    --danger: #dc2626;
    --success: #16a34a;
    --warning: #ca8a04;
    --radius: 8px;
    --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: var(--font);
    font-size: 14px;
    line-height: 1.5;
    color: var(--fg);
    background: var(--bg);
    padding: 16px;
  }

  button {
    cursor: pointer;
    border: none;
    border-radius: var(--radius);
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 500;
  }

  .btn-primary {
    background: var(--accent);
    color: white;
  }
  .btn-primary:hover { background: var(--accent-hover); }

  .btn-secondary {
    background: transparent;
    color: var(--accent);
    border: 1px solid var(--border);
  }

  input, textarea {
    width: 100%;
    padding: 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: 14px;
    font-family: var(--font);
  }

  .provider-option {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    margin-bottom: 8px;
  }
  .provider-option.selected {
    border-color: var(--accent);
    background: #eff6ff;
  }

  .privacy-note {
    font-size: 12px;
    color: var(--muted);
    background: #f5f5f5;
    padding: 10px;
    border-radius: var(--radius);
    margin-top: 12px;
  }

  .step-indicator {
    display: flex;
    gap: 6px;
    margin-bottom: 20px;
  }
  .step-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: var(--border);
  }
  .step-dot.active { background: var(--accent); }
  .step-dot.done { background: var(--success); }

  h1 { font-size: 20px; margin-bottom: 8px; }
  h2 { font-size: 16px; margin-bottom: 8px; }
  p { margin-bottom: 12px; }
  .spacer { height: 16px; }

  - Step 2: Create Onboarding.jsx

  // extension/src/sidepanel/components/Onboarding.jsx
  import { useState } from 'preact/hooks';
  import { saveSettings, completeOnboarding } from '../../shared/storage.js';
  import { createClient } from '../../core/llm-client.js';

  const PROVIDERS = [
    { id: 'anthropic', name: 'Anthropic', model: 'claude-sonnet-4-6', label: 'Claude' },
    { id: 'openai', name: 'OpenAI', model: 'gpt-4o', label: 'GPT-4o' },
    { id: 'google', name: 'Google', model: 'gemini-2.0-flash', label: 'Gemini' },
    { id: 'openai-compatible', name: 'Other (OpenAI-compatible)', model: '', label: 'Custom' },
  ];

  const KEY_URLS = {
    anthropic: 'https://console.anthropic.com/settings/keys',
    openai: 'https://platform.openai.com/api-keys',
    google: 'https://aistudio.google.com/apikey',
  };

  export function Onboarding({ onComplete }) {
    const [step, setStep] = useState(0);
    const [provider, setProvider] = useState(null);
    const [apiKey, setApiKey] = useState('');
    const [baseUrl, setBaseUrl] = useState('');
    const [model, setModel] = useState('');
    const [testStatus, setTestStatus] = useState('idle');
    const [testError, setTestError] = useState(null);

    const totalSteps = 5;

    const handleProviderSelect = (p) => {
      setProvider(p);
      setModel(p.model);
    };

    const handleTestRun = async () => {
      setTestStatus('running');
      setTestError(null);

      const config = {
        apiKey,
        model: model || provider.model,
        baseUrl: baseUrl || undefined,
      };

      const client = createClient(provider.id, config);
      const result = await client.call(
        'Return JSON: {"status": "ok"}',
        'Respond with the requested JSON.',
        100,
      );

      if (result) {
        setTestStatus('success');
        await saveSettings({
          provider: provider.id,
          apiKey,
          model: model || provider.model,
          baseUrl: baseUrl || null,
        });
      } else {
        setTestStatus('error');
        setTestError('Could not connect. Check your API key and try again.');
      }
    };

    const handleDone = async () => {
      await completeOnboarding();
      onComplete();
    };

    return (
      <div class="onboarding">
        <div class="step-indicator">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div class={`step-dot ${i < step ? 'done' : i === step ? 'active' : ''}`} />
          ))}
        </div>

        {step === 0 && (
          <div>
            <h1>First Misread</h1>
            <p>Find where your writing gets misunderstood — before a real reader does.</p>
            <div class="spacer" />
            <button class="btn-primary" onClick={() => setStep(1)}>Get Started</button>
          </div>
        )}

        {step === 1 && (
          <div>
            <h2>Pick your LLM provider</h2>
            <p>Your API key stays on your device. We never see it.</p>
            <div class="spacer" />
            {PROVIDERS.map(p => (
              <div
                class={`provider-option ${provider?.id === p.id ? 'selected' : ''}`}
                onClick={() => handleProviderSelect(p)}
              >
                <strong>{p.label}</strong>
                <span style={{ color: 'var(--muted)' }}>{p.name}</span>
              </div>
            ))}
            <div class="spacer" />
            <button class="btn-primary" disabled={!provider} onClick={() => setStep(2)}>
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2>Paste your API key</h2>
            {KEY_URLS[provider?.id] && (
              <p><a href={KEY_URLS[provider.id]} target="_blank" rel="noopener">Get an API key →</a></p>
            )}
            <input
              type="password"
              placeholder="API key"
              value={apiKey}
              onInput={(e) => setApiKey(e.target.value)}
            />
            {provider?.id === 'openai-compatible' && (
              <>
                <div class="spacer" />
                <input placeholder="Base URL (e.g. http://localhost:11434/v1)" value={baseUrl} onInput={(e) => setBaseUrl(e.target.value)} />
                <div class="spacer" />
                <input placeholder="Model name" value={model} onInput={(e) => setModel(e.target.value)} />
              </>
            )}
            <div class="privacy-note">
              Your key stays on your device. We never see it, store it, or transmit it to our servers. It goes directly from your browser to your LLM provider.
            </div>
            <div class="spacer" />
            <button class="btn-primary" disabled={!apiKey} onClick={() => setStep(3)}>
              Continue
            </button>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2>Test your connection</h2>
            {testStatus === 'idle' && (
              <button class="btn-primary" onClick={handleTestRun}>Run Test</button>
            )}
            {testStatus === 'running' && <p>Testing connection...</p>}
            {testStatus === 'success' && (
              <div>
                <p style={{ color: 'var(--success)' }}>Connected successfully!</p>
                <div class="spacer" />
                <button class="btn-primary" onClick={() => setStep(4)}>Continue</button>
              </div>
            )}
            {testStatus === 'error' && (
              <div>
                <p style={{ color: 'var(--danger)' }}>{testError}</p>
                <div class="spacer" />
                <button class="btn-secondary" onClick={() => { setTestStatus('idle'); setStep(2); }}>
                  Go Back
                </button>
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div>
            <h1>You're set!</h1>
            <p>Open any page and click the First Misread icon to analyze your writing.</p>
            <div class="spacer" />
            <button class="btn-primary" onClick={handleDone}>Start Analyzing</button>
          </div>
        )}
      </div>
    );
  }

  - Step 3: Update index.jsx to use Onboarding

  // extension/src/sidepanel/index.jsx
  import { render } from 'preact';
  import { useState, useEffect } from 'preact/hooks';
  import { isOnboardingComplete } from '../shared/storage.js';
  import { Onboarding } from './components/Onboarding.jsx';
  import './styles/panel.css';

  function App() {
    const [showOnboarding, setShowOnboarding] = useState(null);

    useEffect(() => {
      isOnboardingComplete().then(complete => setShowOnboarding(!complete));
    }, []);

    if (showOnboarding === null) return null;

    if (showOnboarding) {
      return <Onboarding onComplete={() => setShowOnboarding(false)} />;
    }

    return <div>Analyzer view (Task 15)</div>;
  }

  render(<App />, document.getElementById('app'));

  - Step 4: Build and manually test onboarding flow

  Run: cd extension && npm run build
  Reload unpacked extension. Click icon. Should see onboarding wizard.

  - Step 5: Commit

  git add extension/src/sidepanel/ extension/src/sidepanel/styles/
  git commit -m "feat(extension): onboarding wizard with provider selection and API key setup"

  ---
  Task 15: Analyzer UI (Main View)

  Files:
  - Create: extension/src/sidepanel/components/Analyzer.jsx
  - Create: extension/src/sidepanel/components/PersonaProgress.jsx
  - Create: extension/src/sidepanel/components/ResultsSummary.jsx
  - Create: extension/src/sidepanel/components/FindingCard.jsx
  - Modify: extension/src/sidepanel/index.jsx

  Main analysis view with streaming persona progress and aggregated results.

  - Step 1: Create PersonaProgress.jsx

  // extension/src/sidepanel/components/PersonaProgress.jsx

  const STATUS_ICONS = { waiting: '○', reading: '⟳', done: '✓', error: '✗' };

  export function PersonaProgress({ personas }) {
    return (
      <div class="persona-progress">
        {personas.map(p => (
          <div class="persona-row" key={p.name}>
            <span class={`status-icon ${p.status}`}>{STATUS_ICONS[p.status]}</span>
            <span class="persona-name">{p.name}</span>
            {p.status === 'done' && (
              <span class="finding-count">{p.findingCount} finding{p.findingCount !== 1 ? 's' : ''}</span>
            )}
          </div>
        ))}
      </div>
    );
  }

  - Step 2: Create FindingCard.jsx

  // extension/src/sidepanel/components/FindingCard.jsx
  import { useState } from 'preact/hooks';
  import { signalStrength } from '../../core/models.js';

  const SEVERITY_COLORS = { high: '#dc2626', medium: '#ca8a04', low: '#9ca3af' };

  export function FindingCard({ finding, onFeedback, compact }) {
    const [expanded, setExpanded] = useState(false);

    if (compact) {
      return (
        <div class="finding-card dismissed">
          <div class="finding-header">
            <span class="severity-dot" style={{ background: SEVERITY_COLORS[finding.severity] }} />
            <span class="finding-desc-truncated">{finding.descriptions[0]?.what_happened}</span>
            <span class="finding-meta-inline">{signalStrength(finding.personas)}</span>
            <button class="btn-icon" onClick={(e) => { e.stopPropagation(); onFeedback('pending'); }}
              title="Restore">↩</button>
          </div>
        </div>
      );
    }

    return (
      <div class={`finding-card ${finding.feedbackStatus === 'accepted' ? 'accepted' : ''}`}
        onClick={() => setExpanded(!expanded)}>
        <div class="finding-header">
          <span class="severity-badge" style={{ background: SEVERITY_COLORS[finding.severity] }}>
            {finding.severity}
          </span>
          <span class="finding-desc">{finding.descriptions[0]?.what_happened}</span>
          <div class="finding-actions" onClick={(e) => e.stopPropagation()}>
            <button class="btn-icon" onClick={() => onFeedback('accepted')}
              title="Accept" style={finding.feedbackStatus === 'accepted' ? { color: 'var(--success)' } : {}}>✓</button>
            <button class="btn-icon" onClick={() => onFeedback('dismissed')} title="Dismiss">×</button>
          </div>
        </div>
        <div class="finding-meta">
          {signalStrength(finding.personas)} · {finding.location}
        </div>
        {expanded && (
          <div class="finding-detail">
            <blockquote>"{finding.passage}"</blockquote>
            {finding.descriptions.map(d => (
              <p key={d.persona}><strong>{d.persona}:</strong> {d.what_happened}</p>
            ))}
          </div>
        )}
      </div>
    );
  }

  - Step 3: Create ResultsSummary.jsx

  // extension/src/sidepanel/components/ResultsSummary.jsx
  import { useState } from 'preact/hooks';
  import { FindingCard } from './FindingCard.jsx';

  export function ResultsSummary({ aggregatedFindings, personaResults, onFeedback }) {
    const [showDismissed, setShowDismissed] = useState(false);

    const active = aggregatedFindings.filter(f => f.feedbackStatus !== 'dismissed');
    const dismissed = aggregatedFindings.filter(f => f.feedbackStatus === 'dismissed');
    const activeCount = active.length;

    return (
      <div class="results-summary">
        <h2>{activeCount} finding{activeCount !== 1 ? 's' : ''}</h2>

        {activeCount === 0 && dismissed.length === 0 && (
          <p class="no-findings">No misread risks detected. Your writing looks clear!</p>
        )}

        {active.map((f, i) => (
          <FindingCard key={i} finding={f} onFeedback={(status) => onFeedback(i, f, status)} />
        ))}

        {dismissed.length > 0 && (
          <div class="dismissed-section">
            <button class="btn-text" onClick={() => setShowDismissed(!showDismissed)}>
              {showDismissed ? '▾' : '▸'} Dismissed ({dismissed.length})
            </button>
            {showDismissed && dismissed.map((f, i) => (
              <FindingCard key={`d-${i}`} finding={f} compact
                onFeedback={(status) => onFeedback(aggregatedFindings.indexOf(f), f, status)} />
            ))}
          </div>
        )}

        <div class="spacer" />
        <h3>Persona Verdicts</h3>
        <div class="persona-verdicts">
          {personaResults.map(r => (
            <span key={r.persona} class={`verdict-pill ${r.findings.length ? 'concerns' : 'pass'}`}>
              {r.findings.length ? '⚠' : '✓'} {r.persona}
            </span>
          ))}
        </div>
      </div>
    );
  }

  - Step 4: Create Analyzer.jsx

  // extension/src/sidepanel/components/Analyzer.jsx
  import { useState, useRef } from 'preact/hooks';
  import { PersonaProgress } from './PersonaProgress.jsx';
  import { ResultsSummary } from './ResultsSummary.jsx';
  import { fingerprintFinding } from '../../core/feedback.js';

  export function Analyzer() {
    const [status, setStatus] = useState('idle');
    const [pasteText, setPasteText] = useState('');
    const [platform, setPlatform] = useState(null);
    const [personas, setPersonas] = useState([]);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [pageUrl, setPageUrl] = useState(null);
    const portRef = useRef(null);

    const handleFeedback = (index, finding, newStatus) => {
      if (!portRef.current || !pageUrl) return;

      portRef.current.postMessage({
        type: 'feedback:update',
        url: pageUrl,
        findingFingerprint: fingerprintFinding(finding),
        status: newStatus,
      });

      setResult(prev => {
        const updated = [...prev.aggregatedFindings];
        updated[index] = { ...updated[index], feedbackStatus: newStatus };
        return { ...prev, aggregatedFindings: updated };
      });
    };

    const startAnalysis = (type, text) => {
      setStatus('extracting');
      setError(null);
      setResult(null);
      setPersonas([]);

      const port = chrome.runtime.connect();
      portRef.current = port;

      port.onMessage.addListener((msg) => {
        switch (msg.type) {
          case 'progress:extracting':
            setStatus('extracting');
            break;
          case 'progress:extracted':
            setPlatform(msg.platform);
            setPageUrl(msg.url || null);
            setStatus('analyzing');
            break;
          case 'progress:metadata':
            setStatus('analyzing');
            break;
          case 'progress:personas-selected':
            setPersonas(msg.personas.map(name => ({ name, status: 'waiting', findingCount: 0 })));
            break;
          case 'progress:persona-started':
            setPersonas(prev => prev.map(p =>
              p.name === msg.persona ? { ...p, status: 'reading' } : p
            ));
            break;
          case 'progress:persona-done':
            setPersonas(prev => prev.map(p =>
              p.name === msg.persona ? { ...p, status: 'done', findingCount: msg.findingCount } : p
            ));
            break;
          case 'results:complete':
            setResult({ personaResults: msg.personaResults, aggregatedFindings: msg.aggregatedFindings });
            setStatus('complete');
            break;
          case 'feedback:applied':
            break;
          case 'error':
            setError(msg.message);
            setStatus('error');
            port.disconnect();
            portRef.current = null;
            break;
        }
      });

      if (type === 'page') {
        port.postMessage({ type: 'analyze-page' });
      } else {
        port.postMessage({ type: 'analyze-text', text });
      }
    };

    return (
      <div class="analyzer">
        <div class="header">
          <h1>First Misread</h1>
        </div>

        {status === 'idle' && (
          <div class="input-section">
            <button class="btn-primary" style={{ width: '100%' }} onClick={() => startAnalysis('page')}>
              Analyze This Page
            </button>
            {platform && <div class="platform-badge">{platform} detected</div>}
            <div class="spacer" />
            <p style={{ color: 'var(--muted)', fontSize: '12px', textAlign: 'center' }}>or paste text below</p>
            <textarea
              rows={6}
              placeholder="Paste your writing here..."
              value={pasteText}
              onInput={(e) => setPasteText(e.target.value)}
            />
            {pasteText.trim() && (
              <>
                <div class="spacer" />
                <button class="btn-secondary" onClick={() => startAnalysis('text', pasteText)}>
                  Analyze Pasted Text
                </button>
              </>
            )}
          </div>
        )}

        {(status === 'extracting' || status === 'analyzing') && (
          <div>
            {status === 'extracting' && <p>Extracting text from page...</p>}
            {personas.length > 0 && <PersonaProgress personas={personas} />}
          </div>
        )}

        {status === 'complete' && result && (
          <div>
            <ResultsSummary
              aggregatedFindings={result.aggregatedFindings}
              personaResults={result.personaResults}
              onFeedback={handleFeedback}
            />
            <div class="spacer" />
            <button class="btn-secondary" onClick={() => setStatus('idle')}>
              Analyze Again
            </button>
          </div>
        )}

        {status === 'error' && (
          <div>
            <p style={{ color: 'var(--danger)' }}>{error}</p>
            <div class="spacer" />
            <button class="btn-secondary" onClick={() => setStatus('idle')}>Try Again</button>
          </div>
        )}
      </div>
    );
  }

  - Step 5: Update index.jsx to use Analyzer

  Replace the placeholder "Analyzer view (Task 14)" in index.jsx:

  import { Analyzer } from './components/Analyzer.jsx';

  // In the else branch of the onboarding check:
  return <Analyzer />;

  - Step 6: Add analyzer styles to panel.css

  Append to panel.css:

  .persona-progress { margin: 12px 0; }
  .persona-row {
    display: flex; align-items: center; gap: 8px;
    padding: 6px 0; border-bottom: 1px solid var(--border);
  }
  .status-icon { width: 16px; text-align: center; }
  .status-icon.reading { color: var(--accent); animation: spin 1s linear infinite; }
  .status-icon.done { color: var(--success); }
  .status-icon.error { color: var(--danger); }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  .finding-count { margin-left: auto; color: var(--muted); font-size: 12px; }

  .finding-card {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 12px;
    margin-bottom: 8px;
    cursor: pointer;
  }
  .finding-card:hover { background: #f9f9f9; }
  .finding-header { display: flex; align-items: center; gap: 8px; }
  .severity-badge {
    display: inline-block; padding: 2px 8px; border-radius: 4px;
    color: white; font-size: 11px; font-weight: 600; text-transform: uppercase;
  }
  .finding-meta { font-size: 12px; color: var(--muted); margin-top: 4px; }
  .finding-detail { margin-top: 8px; }
  .finding-detail blockquote {
    border-left: 3px solid var(--border);
    padding-left: 12px; margin: 8px 0;
    color: var(--muted); font-style: italic;
  }

  .persona-verdicts { display: flex; flex-wrap: wrap; gap: 6px; }
  .verdict-pill {
    padding: 4px 10px; border-radius: 16px;
    font-size: 12px; border: 1px solid var(--border);
  }
  .verdict-pill.pass { background: #f0fdf4; color: var(--success); }
  .verdict-pill.concerns { background: #fffbeb; color: var(--warning); }

  .no-findings {
    text-align: center; color: var(--success);
    padding: 24px; background: #f0fdf4;
    border-radius: var(--radius);
  }

  .finding-card.dismissed {
    opacity: 0.6; padding: 8px 12px;
    border-style: dashed;
  }
  .finding-card.accepted { border-color: var(--success); background: #f0fdf4; }

  .finding-actions { display: flex; gap: 4px; margin-left: auto; }
  .btn-icon {
    background: none; border: 1px solid var(--border); border-radius: 4px;
    width: 28px; height: 28px; padding: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; color: var(--muted); cursor: pointer;
  }
  .btn-icon:hover { background: #f5f5f5; color: var(--fg); }
  .btn-text {
    background: none; border: none; padding: 8px 0;
    font-size: 13px; color: var(--muted); cursor: pointer;
    text-align: left; width: 100%;
  }
  .btn-text:hover { color: var(--fg); }

  .severity-dot {
    width: 8px; height: 8px; border-radius: 50%;
    display: inline-block; flex-shrink: 0;
  }
  .finding-desc-truncated {
    flex: 1; font-size: 13px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .finding-meta-inline { font-size: 11px; color: var(--muted); white-space: nowrap; }

  .dismissed-section { margin-top: 16px; border-top: 1px solid var(--border); padding-top: 8px; }

  - Step 7: Build and manually test full flow

  Run: cd extension && npm run build
  Reload extension. Open a page with text. Click icon → side panel. Click "Analyze This Page". Verify streaming progress and results display.

  - Step 8: Commit

  git add extension/src/sidepanel/
  git commit -m "feat(extension): analyzer UI with streaming persona progress and results"

  ---
  Task 16: Settings View

  Files:
  - Create: extension/src/sidepanel/components/Settings.jsx
  - Modify: extension/src/sidepanel/index.jsx

  Accessible from header. Change provider, key, model.

  - Step 1: Create Settings.jsx

  // extension/src/sidepanel/components/Settings.jsx
  import { useState, useEffect } from 'preact/hooks';
  import { getSettings, saveSettings } from '../../shared/storage.js';

  const PROVIDERS = [
    { id: 'anthropic', name: 'Anthropic (Claude)' },
    { id: 'openai', name: 'OpenAI (GPT)' },
    { id: 'google', name: 'Google (Gemini)' },
    { id: 'openai-compatible', name: 'Other (OpenAI-compatible)' },
  ];

  export function Settings({ onBack }) {
    const [settings, setSettings] = useState(null);
    const [saved, setSaved] = useState(false);

    useEffect(() => { getSettings().then(setSettings); }, []);

    if (!settings) return null;

    const update = (key, value) => {
      setSettings({ ...settings, [key]: value });
      setSaved(false);
    };

    const handleSave = async () => {
      await saveSettings(settings);
      setSaved(true);
    };

    return (
      <div class="settings">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <button class="btn-secondary" onClick={onBack}>← Back</button>
          <h2 style={{ margin: 0 }}>Settings</h2>
        </div>

        <label>Provider</label>
        <select value={settings.provider || ''} onChange={(e) => update('provider', e.target.value)}>
          {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <div class="spacer" />
        <label>API Key</label>
        <input type="password" value={settings.apiKey || ''} onInput={(e) => update('apiKey', e.target.value)} />

        <div class="spacer" />
        <label>Model</label>
        <input value={settings.model || ''} onInput={(e) => update('model', e.target.value)} />

        {(settings.provider === 'openai-compatible' || settings.baseUrl) && (
          <>
            <div class="spacer" />
            <label>Base URL</label>
            <input value={settings.baseUrl || ''} onInput={(e) => update('baseUrl', e.target.value)} />
          </>
        )}

        <div class="privacy-note">
          Your key stays on your device. We never see it, store it, or transmit it to our servers.
        </div>

        <div class="spacer" />
        <button class="btn-primary" onClick={handleSave}>
          {saved ? '✓ Saved' : 'Save Settings'}
        </button>
      </div>
    );
  }

  - Step 2: Add settings routing to index.jsx

  Update App component to add a view state and gear icon:

  function App() {
    const [showOnboarding, setShowOnboarding] = useState(null);
    const [view, setView] = useState('analyzer');

    useEffect(() => {
      isOnboardingComplete().then(complete => setShowOnboarding(!complete));
    }, []);

    if (showOnboarding === null) return null;
    if (showOnboarding) return <Onboarding onComplete={() => setShowOnboarding(false)} />;

    if (view === 'settings') return <Settings onBack={() => setView('analyzer')} />;

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button class="btn-secondary" style={{ padding: '4px 8px', fontSize: '16px' }}
            onClick={() => setView('settings')}>⚙</button>
        </div>
        <Analyzer />
      </div>
    );
  }

  Add the Settings import at the top.

  - Step 3: Add select styling to panel.css

  select {
    width: 100%;
    padding: 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: 14px;
    background: white;
  }
  label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: var(--muted);
    margin-bottom: 4px;
  }

  - Step 4: Build and manually test settings

  Run: cd extension && npm run build
  Reload extension. Click gear icon. Change provider. Save. Verify settings persist.

  - Step 5: Commit

  git add extension/src/sidepanel/
  git commit -m "feat(extension): settings view with provider/key/model configuration"

  ---
  Task 17: End-to-End Manual Test

  No new files. This is a verification task.

  - Step 1: Clean build

  Run: cd extension && npm run build

  - Step 2: Load unpacked extension in Chrome

  chrome://extensions → Developer Mode → Load unpacked → select extension/build/

  - Step 3: Complete onboarding with a real API key

  Use Anthropic (or whichever provider you have a key for). Verify test run passes.

  - Step 4: Navigate to a Substack post and analyze

  Open any Substack post. Click extension icon. Click "Analyze This Page". Verify:
  - Text extraction works
  - Persona selection happens
  - Streaming progress shows
  - Results display correctly
  - Step 5: Test paste flow

  Paste text into the textarea instead. Click "Analyze Pasted Text". Verify same pipeline runs.

  - Step 6: Test settings persistence

  Close and reopen side panel. Open settings. Verify API key and provider are preserved.

  - Step 7: Test dismiss/accept flow

  After results display: click dismiss (×) on a finding → it moves to collapsed "Dismissed" section. Click accept (✓) on another → green border appears. Expand dismissed section → click restore (↩) → finding returns to active list. Re-run analysis on same page → dismissed/accepted states carry forward.

  - Step 8: Run all unit tests

  Run: cd extension && npx vitest run
  Expected: All tests pass.

  - Step 9: Commit any fixes needed

  git add -A && git commit -m "fix(extension): end-to-end test fixes"

  (Only if there are fixes. Skip if everything passed clean.)
