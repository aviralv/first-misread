import { useState } from 'preact/hooks';
import { signalStrength } from '../../core/models.js';

const SEVERITY_COLORS = { high: '#dc2626', medium: '#ca8a04', low: '#9ca3af' };

export function FindingCard({ finding, onFeedback, onHighlight, compact }) {
  const [expanded, setExpanded] = useState(false);

  if (compact) {
    return (
      <div class="finding-card dismissed">
        <div class="finding-header">
          <span class="severity-dot" style={{ background: SEVERITY_COLORS[finding.severity] }} />
          <span class="finding-desc-truncated">{finding.descriptions[0]?.what_happened}</span>
          <span class="finding-meta-inline">{signalStrength(finding.personas)}</span>
          <button class="btn-icon" onClick={(e) => { e.stopPropagation(); onFeedback('pending'); }}
            title="Restore">↩</button>
        </div>
      </div>
    );
  }

  return (
    <div class={`finding-card ${finding.feedbackStatus === 'accepted' ? 'accepted' : ''}`}
      onClick={() => { setExpanded(!expanded); onHighlight?.(); }}>
      <div class="finding-header">
        <span class="severity-badge" style={{ background: SEVERITY_COLORS[finding.severity] }}>
          {finding.severity}
        </span>
        <span class="finding-desc">{finding.descriptions[0]?.what_happened}</span>
        <div class="finding-actions" onClick={(e) => e.stopPropagation()}>
          <button class="btn-icon" onClick={() => onFeedback('accepted')}
            title="Accept" style={finding.feedbackStatus === 'accepted' ? { color: 'var(--success)' } : {}}>✓</button>
          <button class="btn-icon" onClick={() => onFeedback('dismissed')} title="Dismiss">×</button>
        </div>
      </div>
      <div class="finding-meta">
        {signalStrength(finding.personas)} · {finding.location}
      </div>
      {expanded && (
        <div class="finding-detail">
          <blockquote>"{finding.passage}"</blockquote>
          {finding.descriptions.map(d => (
            <p key={d.persona}><strong>{d.persona}:</strong> {d.what_happened}</p>
          ))}
        </div>
      )}
    </div>
  );
}
