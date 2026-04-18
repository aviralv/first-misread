import { MarkdownView, Notice, type App, type Editor, type EditorPosition } from "obsidian";

function normalize(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u2014\u2013]/g, "-")
    .replace(/[\u2026]/g, "...")
    .replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function fuzzyIndexOf(haystack: string, needle: string): { index: number; length: number } | null {
  const idx = haystack.indexOf(needle);
  if (idx !== -1) return { index: idx, length: needle.length };

  const normHaystack = normalize(haystack);
  const normNeedle = normalize(needle);
  const normIdx = normHaystack.indexOf(normNeedle);
  if (normIdx !== -1) {
    let origStart = 0;
    let normPos = 0;
    while (normPos < normIdx && origStart < haystack.length) {
      const normChunk = normalize(haystack[origStart]);
      if (normChunk.length > 0) normPos += normChunk.length;
      origStart++;
    }
    let origEnd = origStart;
    let matchLen = 0;
    while (matchLen < normNeedle.length && origEnd < haystack.length) {
      const normChunk = normalize(haystack[origEnd]);
      if (normChunk.length > 0) matchLen += normChunk.length;
      origEnd++;
    }
    return { index: origStart, length: origEnd - origStart };
  }

  const words = normNeedle.split(" ").filter(Boolean);
  if (words.length < 4) return null;

  let bestStart = -1;
  let bestEnd = -1;
  let bestScore = 0;

  for (let windowStart = 0; windowStart <= words.length - 3; windowStart++) {
    const chunk = words.slice(windowStart, windowStart + Math.min(6, words.length - windowStart)).join(" ");
    const chunkIdx = normHaystack.indexOf(chunk);
    if (chunkIdx === -1) continue;

    let start = chunkIdx;
    let end = chunkIdx + chunk.length;

    for (let i = windowStart - 1; i >= 0; i--) {
      const prefix = words.slice(i, windowStart + 1).join(" ");
      const prefixIdx = normHaystack.lastIndexOf(prefix, start + prefix.length);
      if (prefixIdx !== -1 && prefixIdx <= start) {
        start = prefixIdx;
      } else break;
    }

    for (let i = windowStart + 6; i < words.length; i++) {
      const suffix = words.slice(windowStart, i + 1).join(" ");
      const suffixIdx = normHaystack.indexOf(suffix, start);
      if (suffixIdx !== -1) {
        end = suffixIdx + suffix.length;
      } else break;
    }

    const score = end - start;
    if (score > bestScore) {
      bestScore = score;
      bestStart = start;
      bestEnd = end;
    }
  }

  if (bestStart === -1 || bestScore < normNeedle.length * 0.5) return null;

  let origStart = 0;
  let normPos = 0;
  while (normPos < bestStart && origStart < haystack.length) {
    const ch = haystack[origStart];
    const normCh = normalize(ch);
    if (normCh.length > 0) normPos += normCh.length;
    origStart++;
  }
  let origEnd = origStart;
  while (normPos < bestEnd && origEnd < haystack.length) {
    const ch = haystack[origEnd];
    const normCh = normalize(ch);
    if (normCh.length > 0) normPos += normCh.length;
    origEnd++;
  }

  return { index: origStart, length: origEnd - origStart };
}

export function highlightInEditor(editor: Editor, passage: string): boolean {
  const lineCount = editor.lineCount();
  const lines: string[] = [];
  const lineStartOffsets: number[] = [];
  let running = 0;
  for (let i = 0; i < lineCount; i++) {
    const line = editor.getLine(i);
    lineStartOffsets.push(running);
    lines.push(line);
    running += line.length + 1;
  }
  const fullText = lines.join("\n");
  const match = fuzzyIndexOf(fullText, passage);
  if (!match) return false;

  const offsetToPos = (offset: number): EditorPosition => {
    for (let i = lineStartOffsets.length - 1; i >= 0; i--) {
      if (offset >= lineStartOffsets[i]) {
        return { line: i, ch: offset - lineStartOffsets[i] };
      }
    }
    return { line: 0, ch: 0 };
  };

  const from = offsetToPos(match.index);
  const to = offsetToPos(match.index + match.length);
  editor.setSelection(from, to);
  editor.scrollIntoView({ from, to }, true);
  return true;
}

export function highlightInReadingMode(contentEl: HTMLElement, passage: string): boolean {
  contentEl.querySelectorAll("mark.fm-passage-highlight").forEach((mark) => {
    const parent = mark.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(mark.textContent || ""), mark);
      parent.normalize();
    }
  });

  const walker = document.createTreeWalker(contentEl, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  const offsets: number[] = [];
  let total = 0;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    offsets.push(total);
    nodes.push(node as Text);
    total += (node as Text).length;
  }

  const fullText = nodes.map((n) => n.textContent).join("");
  const match = fuzzyIndexOf(fullText, passage);
  if (!match) return false;

  const findNodeAndOffset = (flatOffset: number): [Text, number] => {
    for (let i = nodes.length - 1; i >= 0; i--) {
      if (flatOffset >= offsets[i]) {
        return [nodes[i], flatOffset - offsets[i]];
      }
    }
    return [nodes[0], 0];
  };

  const [startNode, startOffset] = findNodeAndOffset(match.index);
  const [endNode, endOffset] = findNodeAndOffset(match.index + match.length);

  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);

  try {
    const mark = document.createElement("mark");
    mark.className = "fm-passage-highlight";
    range.surroundContents(mark);
    mark.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch {
    startNode.parentElement?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  return true;
}

export function findNoteView(app: App, targetPath: string): MarkdownView | null {
  let found: MarkdownView | null = null;
  app.workspace.iterateAllLeaves((leaf) => {
    if (found) return;
    const view = leaf.view;
    if (view instanceof MarkdownView && view.file?.path === targetPath) {
      found = view;
    }
  });
  return found;
}

export function highlightPassage(app: App, targetPath: string, passage: string): void {
  const view = findNoteView(app, targetPath);
  if (!view) {
    new Notice("Open the note to highlight passages.");
    return;
  }
  app.workspace.revealLeaf(view.leaf);
  const mode = view.getMode();
  if (mode === "source") {
    if (!highlightInEditor(view.editor, passage)) {
      new Notice("Passage not found — the note may have been edited since analysis.");
    }
  } else {
    if (!highlightInReadingMode(view.contentEl, passage)) {
      new Notice("Passage not found — the note may have been edited since analysis.");
    }
  }
}
