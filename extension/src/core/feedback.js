import { passagesOverlap } from './aggregator.js';

export function fingerprintFinding(finding) {
  const personas = [...finding.personas].sort().join(',');
  const passage = finding.passage.toLowerCase().slice(0, 80);
  const desc = (finding.descriptions[0]?.what_happened || '').toLowerCase().slice(0, 60);
  return `${personas}|${passage}|${desc}`;
}

export function matchFindings(oldFinding, newFinding) {
  const personaOverlap = oldFinding.personas.some(p => newFinding.personas.includes(p));
  if (!personaOverlap) return false;

  if (!passagesOverlap(oldFinding.passage, newFinding.passage)) return false;

  const oldDesc = oldFinding.descriptions.map(d => d.what_happened).join(' ');
  const newDesc = newFinding.descriptions.map(d => d.what_happened).join(' ');
  if (!passagesOverlap(oldDesc, newDesc)) return false;

  return true;
}

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

  storeFindings(url, findings) {
    for (const f of findings) {
      if (f.feedbackStatus !== 'pending') {
        this.setFeedback(url, fingerprintFinding(f), f.feedbackStatus);
      }
    }
  }

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
