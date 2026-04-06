import { useState } from 'preact/hooks';
import { FindingCard } from './FindingCard.jsx';

export function ResultsSummary({ aggregatedFindings, personaResults, onFeedback, onHighlight }) {
  const [showDismissed, setShowDismissed] = useState(false);

  const active = aggregatedFindings.filter(f => f.feedbackStatus !== 'dismissed');
  const dismissed = aggregatedFindings.filter(f => f.feedbackStatus === 'dismissed');
  const activeCount = active.length;

  return (
    <div class="results-summary">
      <h2>{activeCount} finding{activeCount !== 1 ? 's' : ''}</h2>

      {activeCount === 0 && dismissed.length === 0 && (
        <p class="no-findings">No misread risks detected. Your writing looks clear!</p>
      )}

      {active.map((f, i) => (
        <FindingCard key={i} finding={f}
          onFeedback={(status) => onFeedback(i, f, status)}
          onHighlight={() => onHighlight?.(f.passage)} />
      ))}

      {dismissed.length > 0 && (
        <div class="dismissed-section">
          <button class="btn-text" onClick={() => setShowDismissed(!showDismissed)}>
            {showDismissed ? '▾' : '▸'} Dismissed ({dismissed.length})
          </button>
          {showDismissed && dismissed.map((f, i) => (
            <FindingCard key={`d-${i}`} finding={f} compact
              onFeedback={(status) => onFeedback(aggregatedFindings.indexOf(f), f, status)} />
          ))}
        </div>
      )}

      <div class="spacer" />
      <h3>Persona Verdicts</h3>
      <div class="persona-verdicts">
        {personaResults.map(r => (
          <span key={r.persona} class={`verdict-pill ${r.findings.length ? 'concerns' : 'pass'}`}>
            {r.findings.length ? '⚠' : '✓'} {r.persona}
          </span>
        ))}
      </div>
    </div>
  );
}
