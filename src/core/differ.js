import { passagesOverlap } from "./aggregator.js";

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };

function findMatch(finding, candidates) {
  for (const candidate of candidates) {
    if (passagesOverlap(finding.passage, candidate.passage)) {
      return candidate;
    }
  }
  return null;
}

function computeSeverityChange(current, parent) {
  const c = SEVERITY_ORDER[current] ?? 99;
  const p = SEVERITY_ORDER[parent] ?? 99;
  if (c < p) return "escalated";
  if (c > p) return "de-escalated";
  return null;
}

function computeRunStreak(finding, chain) {
  let streak = 0;
  for (let i = chain.length - 1; i >= 0; i--) {
    if (findMatch(finding, chain[i].findings)) {
      streak++;
    } else {
      break;
    }
  }
  return streak + 1;
}

function wasPreviouslyResolved(finding, chain) {
  if (chain.length < 2) return false;
  const parent = chain[chain.length - 1];
  if (findMatch(finding, parent.findings)) return false;
  for (let i = 0; i < chain.length - 1; i++) {
    if (findMatch(finding, chain[i].findings)) return true;
  }
  return false;
}

export function diffFindings(currentFindings, chain) {
  if (!chain || chain.length === 0) {
    return currentFindings.map((f) => ({
      status: "new",
      current_finding: f,
      parent_finding: null,
      severity_change: null,
      persona_count_change: null,
      run_streak: 0,
    }));
  }

  const parent = chain[chain.length - 1];
  const diffs = [];
  const matchedParentIndices = new Set();

  for (const current of currentFindings) {
    let parentMatch = null;
    for (let i = 0; i < parent.findings.length; i++) {
      if (
        !matchedParentIndices.has(i) &&
        passagesOverlap(current.passage, parent.findings[i].passage)
      ) {
        parentMatch = parent.findings[i];
        matchedParentIndices.add(i);
        break;
      }
    }

    if (parentMatch) {
      diffs.push({
        status: "persists",
        current_finding: current,
        parent_finding: parentMatch,
        severity_change: computeSeverityChange(
          current.severity,
          parentMatch.severity
        ),
        persona_count_change:
          current.personas.length - parentMatch.personas.length,
        run_streak: computeRunStreak(current, chain),
      });
    } else if (wasPreviouslyResolved(current, chain)) {
      diffs.push({
        status: "regressed",
        current_finding: current,
        parent_finding: null,
        severity_change: null,
        persona_count_change: null,
        run_streak: 0,
      });
    } else {
      diffs.push({
        status: "new",
        current_finding: current,
        parent_finding: null,
        severity_change: null,
        persona_count_change: null,
        run_streak: 0,
      });
    }
  }

  for (let i = 0; i < parent.findings.length; i++) {
    if (!matchedParentIndices.has(i)) {
      diffs.push({
        status: "resolved",
        current_finding: null,
        parent_finding: parent.findings[i],
        severity_change: null,
        persona_count_change: null,
        run_streak: 0,
      });
    }
  }

  return diffs;
}
