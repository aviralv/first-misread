const STATUS_ICONS = { waiting: '○', reading: '⟳', done: '✓', error: '✗' };

export function PersonaProgress({ personas }) {
  return (
    <div class="persona-progress">
      {personas.map(p => (
        <div class="persona-row" key={p.name}>
          <span class={`status-icon ${p.status}`}>{STATUS_ICONS[p.status]}</span>
          <span class="persona-name">{p.name}</span>
          {p.status === 'done' && (
            <span class="finding-count">{p.findingCount} finding{p.findingCount !== 1 ? 's' : ''}</span>
          )}
        </div>
      ))}
    </div>
  );
}
