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
    } else if (msg.type === 'highlight:passage') {
      handleHighlightPassage(port, msg.passage);
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

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['extractor.js'],
  });

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

function highlightPassageInPage(passage) {
  document.querySelectorAll('mark[data-fm-highlight]').forEach(mark => {
    const parent = mark.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
      parent.normalize();
    }
  });

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const tag = node.parentElement?.tagName?.toLowerCase();
      if (tag === 'script' || tag === 'style' || tag === 'noscript') {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const nodes = [];
  const offsets = [];
  let total = 0;
  let node;
  while ((node = walker.nextNode())) {
    offsets.push(total);
    nodes.push(node);
    total += node.textContent.length;
  }

  const fullText = nodes.map(n => n.textContent).join('');
  const idx = fullText.indexOf(passage);
  if (idx === -1) return false;

  const findNodeAndOffset = (flatOffset) => {
    for (let i = nodes.length - 1; i >= 0; i--) {
      if (flatOffset >= offsets[i]) {
        return [nodes[i], flatOffset - offsets[i]];
      }
    }
    return [nodes[0], 0];
  };

  const [startNode, startOffset] = findNodeAndOffset(idx);
  const [endNode, endOffset] = findNodeAndOffset(idx + passage.length);

  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);

  try {
    const mark = document.createElement('mark');
    mark.setAttribute('data-fm-highlight', '');
    mark.style.cssText = 'background:#ffd54f;color:inherit;border-radius:2px;padding:0 1px;';
    range.surroundContents(mark);
    mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return true;
  } catch {
    startNode.parentElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  }
}

async function handleHighlightPassage(port, passage) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: highlightPassageInPage,
      args: [passage],
    });
  } catch {
    // Silently fail — tab may have navigated away
  }
}
