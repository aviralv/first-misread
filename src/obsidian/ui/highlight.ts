import { MarkdownView, Notice, type App, type Editor, type EditorPosition } from "obsidian";

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
  const idx = fullText.indexOf(passage);
  if (idx === -1) return false;

  const offsetToPos = (offset: number): EditorPosition => {
    for (let i = lineStartOffsets.length - 1; i >= 0; i--) {
      if (offset >= lineStartOffsets[i]) {
        return { line: i, ch: offset - lineStartOffsets[i] };
      }
    }
    return { line: 0, ch: 0 };
  };

  const from = offsetToPos(idx);
  const to = offsetToPos(idx + passage.length);
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
  const idx = fullText.indexOf(passage);
  if (idx === -1) return false;

  const findNodeAndOffset = (flatOffset: number): [Text, number] => {
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
