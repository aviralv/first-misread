interface Finding {
  severity: string;
  personas: string[];
}

interface PersonaResult {
  persona: string;
  findings: any[];
  overall_verdict?: string;
}

interface Props {
  aggregatedFindings: Finding[];
  personaResults: PersonaResult[];
}

export function SummaryBar({ aggregatedFindings, personaResults }: Props) {
  const counts = {
    high: aggregatedFindings.filter((f) => f.severity === "high").length,
    medium: aggregatedFindings.filter((f) => f.severity === "medium").length,
    low: aggregatedFindings.filter((f) => f.severity === "low").length,
  };

  return (
    <div class="fm-summary-bar">
      <div class="fm-severity-counts">
        {counts.high > 0 && (
          <span class="fm-severity-count fm-severity-count-high">
            {counts.high} high
          </span>
        )}
        {counts.medium > 0 && (
          <span class="fm-severity-count fm-severity-count-medium">
            {counts.medium} medium
          </span>
        )}
        {counts.low > 0 && (
          <span class="fm-severity-count fm-severity-count-low">
            {counts.low} low
          </span>
        )}
        {aggregatedFindings.length === 0 && (
          <span class="fm-severity-count fm-severity-count-clear">
            No issues found
          </span>
        )}
      </div>
      <div class="fm-persona-verdicts">
        {personaResults.map((r) => (
          <span
            key={r.persona}
            class={`fm-verdict-pill ${r.findings.length ? "fm-concerns" : "fm-pass"}`}
            title={r.overall_verdict || (r.findings.length ? "Has concerns" : "Clear")}
          >
            {r.findings.length ? "\u26A0" : "\u2713"} {r.persona}
          </span>
        ))}
      </div>
    </div>
  );
}
