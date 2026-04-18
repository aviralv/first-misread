export const MAX_CHAIN_LENGTH = 5;

export async function contentHash(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  const array = Array.from(new Uint8Array(buffer));
  return array.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function createVaultHistory(adapter, basePath) {
  function indexPath(contentId) {
    return `${basePath}/${contentId}/index.json`;
  }

  function runPath(contentId, runId) {
    return `${basePath}/${contentId}/${runId}.json`;
  }

  function inputPath(contentId, runId) {
    return `${basePath}/${contentId}/input-${runId}.md`;
  }

  async function loadIndex(contentId) {
    const path = indexPath(contentId);
    try {
      if (await adapter.exists(path)) {
        return JSON.parse(await adapter.read(path));
      }
    } catch {
      // corrupted index — start fresh
    }
    return { runs: [] };
  }

  async function saveIndex(contentId, index) {
    const dir = `${basePath}/${contentId}`;
    await adapter.mkdir(dir);
    await adapter.write(indexPath(contentId), JSON.stringify(index, null, 2));
  }

  return {
    async saveRun(contentId, record, inputText) {
      const index = await loadIndex(contentId);
      index.runs.push(record.run_id);

      const dir = `${basePath}/${contentId}`;
      await adapter.mkdir(dir);

      await adapter.write(
        runPath(contentId, record.run_id),
        JSON.stringify(record, null, 2)
      );
      await adapter.write(inputPath(contentId, record.run_id), inputText);
      await saveIndex(contentId, index);
    },

    async resolveParent(contentId) {
      const index = await loadIndex(contentId);
      if (index.runs.length === 0) return null;

      const lastRunId = index.runs[index.runs.length - 1];
      try {
        const data = await adapter.read(runPath(contentId, lastRunId));
        return JSON.parse(data);
      } catch {
        return null;
      }
    },

    async loadChain(contentId) {
      const index = await loadIndex(contentId);
      const runIds = index.runs.slice(-MAX_CHAIN_LENGTH);
      const records = [];

      for (const runId of runIds) {
        try {
          const data = await adapter.read(runPath(contentId, runId));
          records.push(JSON.parse(data));
        } catch {
          // skip corrupted records
        }
      }
      return records;
    },

    async loadInput(contentId, runId) {
      const path = inputPath(contentId, runId);
      try {
        if (await adapter.exists(path)) {
          return await adapter.read(path);
        }
      } catch {
        // missing input
      }
      return null;
    },

    async clearHistory(contentId) {
      const index = await loadIndex(contentId);
      for (const runId of index.runs) {
        try { await adapter.remove(runPath(contentId, runId)); } catch {}
        try { await adapter.remove(inputPath(contentId, runId)); } catch {}
      }
      try { await adapter.remove(indexPath(contentId)); } catch {}
      try { await adapter.rmdir(`${basePath}/${contentId}`); } catch {}
    },

    async getRunCount(contentId) {
      const index = await loadIndex(contentId);
      return index.runs.length;
    },
  };
}
