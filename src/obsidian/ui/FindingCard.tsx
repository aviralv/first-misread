import { useState } from "preact/hooks";
import { signalStrength } from "../../core/models.js";

interface Finding {
  passage: string;
  location: string;
  severity: string;
  personas: string[];
  descriptions: Array<{ persona: string; what_happened: string }>;
}

interface Props {
  finding: Finding;
  onHighlight: (passage: string) => void;
}

export function FindingCard({ finding, onHighlight }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div class={`fm-finding-card fm-severity-${finding.severity}`}>
      <div
        class="fm-finding-header"
        onClick={() => setExpanded(!expanded)}
      >
        <span class={`fm-severity-badge fm-severity-${finding.severity}`}>
          {finding.severity}
        </span>
        <span class="fm-finding-desc">
          {finding.descriptions[0]?.what_happened}
        </span>
        <span class="fm-expand-icon">{expanded ? "\u25B4" : "\u25BE"}</span>
      </div>
      <div class="fm-finding-meta">
        {signalStrength(finding.personas)} &middot; {finding.location}
      </div>
      {expanded && (
        <div class="fm-finding-detail">
          <blockquote
            class="fm-passage fm-passage-link"
            onClick={() => onHighlight(finding.passage)}
          >
            <span class="fm-locate-icon">{"\uD83D\uDD0D"}</span>
            "{finding.passage}"
          </blockquote>
          {finding.descriptions.map((d) => (
            <p key={d.persona}>
              <strong>{d.persona}:</strong> {d.what_happened}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
