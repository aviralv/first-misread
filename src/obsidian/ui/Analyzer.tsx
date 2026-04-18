import { useState, useEffect, useRef } from "preact/hooks";
import { Notice, requestUrl, type App } from "obsidian";
import { PersonaProgress } from "./PersonaProgress";
import { ResultsSummary } from "./ResultsSummary";
import { RevisionNotes } from "./RevisionNotes";
import { SummaryBar } from "./SummaryBar";
import { AnalyzerToolbar } from "./AnalyzerToolbar";
import { highlightPassage } from "./highlight";
import { validateInput, runPipeline, stripFrontmatter } from "../../core/pipeline.js";
import { createClient, setHttpFunction } from "../../core/llm-client.js";
import { getCorePersonas, getDynamicPersonas } from "../../core/personas.js";
import { createVaultHistory, contentHash } from "../../core/history.js";
import { diffFindings } from "../../core/differ.js";
import { interpretRevision } from "../../core/interpreter.js";
import type { FirstMisreadSettings } from "../settings";

setHttpFunction(requestUrl);

type Status = "idle" | "analyzing" | "complete" | "error";
type Phase = "personas" | "strengths" | "complete";

interface PersonaState {
  name: string;
  status: string;
  findingCount: number;
}

interface CachedResult {
  result: any;
  diffs: any[];
  revisionNotes: any;
  contentHash: string;
  runCount: number;
}

interface Props {
  app: App;
  settings: FirstMisreadSettings;
}

export function Analyzer({ app, settings }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [phase, setPhase] = useState<Phase>("personas");
  const [personas, setPersonas] = useState<PersonaState[]>([]);
  const [result, setResult] = useState<any>(null);
  const [revisionNotes, setRevisionNotes] = useState<any>(null);
  const [diffs, setDiffs] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [runCount, setRunCount] = useState(0);
  const [staleNote, setStaleNote] = useState(false);
  const analyzedPathRef = useRef<string | null>(null);
  const cancelledRef = useRef(false);
  const cacheRef = useRef<Map<string, CachedResult>>(new Map());

  useEffect(() => {
    const ref = app.workspace.on("active-leaf-change", async () => {
      const currentFile = app.workspace.getActiveFile();
      const currentPath = currentFile?.path ?? null;

      if (currentPath === analyzedPathRef.current) return;

      const cached = currentPath ? cacheRef.current.get(currentPath) : null;
      if (cached && currentFile) {
        const raw = await app.vault.read(currentFile);
        const text = stripFrontmatter(raw);
        const hash = await contentHash(text);
        analyzedPathRef.current = currentPath;
        setResult(cached.result);
        setDiffs(cached.diffs);
        setRevisionNotes(cached.revisionNotes);
        setRunCount(cached.runCount);
        setStaleNote(hash !== cached.contentHash);
        setStatus("complete");
        return;
      }

      analyzedPathRef.current = null;
      setStatus("idle");
      setPersonas([]);
      setResult(null);
      setRevisionNotes(null);
      setDiffs([]);
      setError(null);
      setStaleNote(false);
      setRunCount(0);
    });
    return () => app.workspace.offref(ref);
  }, [app]);

  const doHighlight = (passage: string) => {
    if (!analyzedPathRef.current) return;
    highlightPassage(app, analyzedPathRef.current, passage);
  };

  const cancel = () => {
    cancelledRef.current = true;
    analyzedPathRef.current = null;
    setStatus("idle");
    setPersonas([]);
    setPhase("personas");
  };

  const analyze = async () => {
    const file = app.workspace.getActiveFile();
    if (!file) {
      new Notice("No active note to analyze");
      return;
    }

    if (!settings.apiKey) {
      new Notice("Set your API key in First Misread settings");
      return;
    }

    cancelledRef.current = false;
    setStatus("analyzing");
    setPhase("personas");
    setError(null);
    setResult(null);
    setRevisionNotes(null);
    setDiffs([]);
    setPersonas([]);
    setStaleNote(false);
    analyzedPathRef.current = file.path;

    try {
      const raw = await app.vault.read(file);
      const text = stripFrontmatter(raw);
      validateInput(text);

      const client = createClient(settings.provider, {
        apiKey: settings.apiKey,
        model: settings.model,
        baseUrl: settings.baseUrl || undefined,
        browserMode: true,
      });

      const onProgress = (msg: any) => {
        if (cancelledRef.current) return;
        switch (msg.type) {
          case "personas-selected":
            setPersonas(
              msg.personas.map((name: string) => ({
                name,
                status: "waiting",
                findingCount: 0,
              }))
            );
            break;
          case "persona-started":
            setPersonas((prev) =>
              prev.map((p) =>
                p.name === msg.persona ? { ...p, status: "reading" } : p
              )
            );
            break;
          case "persona-done":
            setPersonas((prev) =>
              prev.map((p) =>
                p.name === msg.persona
                  ? { ...p, status: "done", findingCount: msg.findingCount }
                  : p
              )
            );
            break;
          case "strengths-started":
            setPhase("strengths");
            break;
          case "strengths-done":
            setPhase("complete");
            break;
        }
      };

      const personaConfig = {
        core: getCorePersonas(),
        dynamic: getDynamicPersonas(),
      };
      const pipelineResult = await runPipeline(client, text, onProgress, personaConfig);

      if (cancelledRef.current) return;

      setResult(pipelineResult);

      const contentId = file.path.replace(/\.md$/, "");
      const history = createVaultHistory(app.vault.adapter, settings.resultsFolder);

      const chain = await history.loadChain(contentId);
      let findingDiffs: any[] = [];
      let notes: any = null;

      const parentHasFindings = chain.length > 0 &&
        chain[chain.length - 1].findings?.length > 0;
      if (parentHasFindings) {
        findingDiffs = diffFindings(pipelineResult.aggregatedFindings, chain);
        setDiffs(findingDiffs);

        notes = await interpretRevision(client, findingDiffs, "", chain);
        if (cancelledRef.current) return;
        setRevisionNotes(notes);
      }

      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "")
        .slice(0, 15);
      const runId = `run-${timestamp}`;
      const hash = await contentHash(text);

      const runRecord = {
        run_id: runId,
        timestamp: new Date().toISOString(),
        slug: contentId.split("/").pop() || contentId,
        content_hash: hash,
        word_count: pipelineResult.metadata.wordCount,
        model: settings.model,
        personas_run: pipelineResult.personas.map((p: any) => p.name),
        parent_run_id:
          chain.length > 0 ? chain[chain.length - 1].run_id : null,
        metadata: pipelineResult.metadata,
        findings: pipelineResult.aggregatedFindings,
        persona_verdicts: pipelineResult.personaResults.map((r: any) => ({
          persona: r.persona,
          verdict: r.overall_verdict || "",
          key_issue:
            r.findings.length > 0 ? r.findings[0].what_happened : "none",
        })),
      };

      if (pipelineResult.personaResults.length > 0) {
        await history.saveRun(contentId, runRecord, text);
      }

      const count = await history.getRunCount(contentId);
      setRunCount(count);

      cacheRef.current.set(file.path, {
        result: pipelineResult,
        diffs: findingDiffs,
        revisionNotes: notes,
        contentHash: hash,
        runCount: count,
      });

      setStatus("complete");
    } catch (e: any) {
      if (cancelledRef.current) return;
      setError(e.message || "Unknown error");
      setStatus("error");
    }
  };

  const resetHistory = async () => {
    if (!analyzedPathRef.current) return;
    const contentId = analyzedPathRef.current.replace(/\.md$/, "");
    const history = createVaultHistory(app.vault.adapter, settings.resultsFolder);
    await history.clearHistory(contentId);
    setDiffs([]);
    setRevisionNotes(null);
    setRunCount(0);
    const cached = analyzedPathRef.current ? cacheRef.current.get(analyzedPathRef.current) : null;
    if (cached && analyzedPathRef.current) {
      cacheRef.current.set(analyzedPathRef.current, { ...cached, diffs: [], revisionNotes: null, runCount: 0 });
    }
    new Notice("History cleared for this note.");
  };

  const analyzeAgain = () => {
    setStatus("idle");
    setStaleNote(false);
    analyze();
  };

  return (
    <div class="fm-analyzer">
      {status === "idle" && (
        <div class="fm-idle">
          <p class="fm-hint">Open a note and click Analyze to begin.</p>
          <button class="mod-cta" onClick={analyze}>
            Analyze Active Note
          </button>
        </div>
      )}

      {status === "analyzing" && (
        <div class="fm-analyzing">
          {personas.length > 0 && (
            <PersonaProgress personas={personas} phase={phase} />
          )}
          <AnalyzerToolbar
            onAnalyzeAgain={() => {}}
            onResetHistory={async () => {}}
            onCancel={cancel}
            runCount={0}
            isAnalyzing={true}
          />
        </div>
      )}

      {status === "complete" && result && (
        <div class="fm-complete">
          {staleNote && (
            <div class="fm-stale-banner">
              Note changed since last analysis.{" "}
              <button class="fm-btn-reanalyze" onClick={analyzeAgain}>
                Re-analyze
              </button>
            </div>
          )}
          <SummaryBar
            aggregatedFindings={result.aggregatedFindings}
            personaResults={result.personaResults}
          />
          <ResultsSummary
            aggregatedFindings={result.aggregatedFindings}
            strengths={result.strengths}
            takeaways={result.takeaways}
            onHighlight={doHighlight}
          />
          {diffs.length > 0 && revisionNotes && (
            <RevisionNotes notes={revisionNotes} diffs={diffs} />
          )}
          <AnalyzerToolbar
            onAnalyzeAgain={analyzeAgain}
            onResetHistory={resetHistory}
            runCount={runCount}
            isAnalyzing={false}
          />
        </div>
      )}

      {status === "error" && (
        <div class="fm-error">
          <p class="fm-error-text">{error}</p>
          <button class="fm-btn-secondary" onClick={() => { setStatus("idle"); analyzedPathRef.current = null; }}>
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
