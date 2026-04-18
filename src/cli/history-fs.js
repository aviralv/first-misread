import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

const MAX_CHAIN_LENGTH = 5;

export function contentHash(text) {
  return createHash('sha256').update(text).digest('hex');
}

export function createFsHistory(baseDir) {
  function historyPath() {
    return join(baseDir, 'history.json');
  }

  function loadHistory() {
    const p = historyPath();
    if (existsSync(p)) {
      try { return JSON.parse(readFileSync(p, 'utf8')); } catch { /* corrupted */ }
    }
    return { chains: {}, runs: {} };
  }

  function saveHistory(data) {
    mkdirSync(baseDir, { recursive: true });
    writeFileSync(historyPath(), JSON.stringify(data, null, 2));
  }

  return {
    resolveParent(ref) {
      const history = loadHistory();
      if (history.chains[ref]) {
        return history.chains[ref].slice(-1)[0] || null;
      }
      for (const [, runIds] of Object.entries(history.chains)) {
        if (runIds.includes(ref)) return ref;
      }
      return null;
    },

    loadChain(chainRef) {
      const history = loadHistory();
      let chainKey = null;
      for (const [key, runIds] of Object.entries(history.chains)) {
        if (chainRef === key || runIds.includes(chainRef)) {
          chainKey = key;
          break;
        }
      }
      if (!chainKey) return [];
      const runIds = history.chains[chainKey].slice(-MAX_CHAIN_LENGTH);
      const records = [];
      for (const runId of runIds) {
        const runFile = join(baseDir, runId, 'run.json');
        if (existsSync(runFile)) {
          try { records.push(JSON.parse(readFileSync(runFile, 'utf8'))); } catch { /* skip */ }
        }
      }
      return records;
    },

    loadInput(runId) {
      const inputFile = join(baseDir, runId, 'input.md');
      if (existsSync(inputFile)) return readFileSync(inputFile, 'utf8');
      return null;
    },

    saveRun(slug, record, inputText, skipChain = false) {
      const runDir = join(baseDir, record.run_id);
      mkdirSync(runDir, { recursive: true });
      writeFileSync(join(runDir, 'run.json'), JSON.stringify(record, null, 2));
      writeFileSync(join(runDir, 'input.md'), inputText);

      if (skipChain) return;

      const history = loadHistory();
      const chainKey = record.parent_run_id
        ? Object.entries(history.chains).find(([, ids]) => ids.includes(record.parent_run_id))?.[0] || slug
        : slug;

      if (!history.chains[chainKey]) history.chains[chainKey] = [];
      history.chains[chainKey].push(record.run_id);
      history.runs[record.run_id] = {
        timestamp: record.timestamp,
        slug: record.slug,
        content_hash: record.content_hash,
        parent_run_id: record.parent_run_id,
      };

      saveHistory(history);
    },

    getChains() {
      return loadHistory().chains;
    },

    getRuns() {
      return loadHistory().runs;
    },
  };
}
