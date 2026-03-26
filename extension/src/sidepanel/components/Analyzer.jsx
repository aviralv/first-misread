import { useState, useRef } from 'preact/hooks';
import { PersonaProgress } from './PersonaProgress.jsx';
import { ResultsSummary } from './ResultsSummary.jsx';
import { fingerprintFinding } from '../../core/feedback.js';

export function Analyzer() {
  const [status, setStatus] = useState('idle');
  const [pasteText, setPasteText] = useState('');
  const [platform, setPlatform] = useState(null);
  const [personas, setPersonas] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [pageUrl, setPageUrl] = useState(null);
  const portRef = useRef(null);

  const handleFeedback = (index, finding, newStatus) => {
    if (!portRef.current || !pageUrl) return;

    portRef.current.postMessage({
      type: 'feedback:update',
      url: pageUrl,
      findingFingerprint: fingerprintFinding(finding),
      status: newStatus,
    });

    setResult(prev => {
      const updated = [...prev.aggregatedFindings];
      updated[index] = { ...updated[index], feedbackStatus: newStatus };
      return { ...prev, aggregatedFindings: updated };
    });
  };

  const startAnalysis = (type, text) => {
    setStatus('extracting');
    setError(null);
    setResult(null);
    setPersonas([]);

    const port = chrome.runtime.connect();
    portRef.current = port;

    port.onMessage.addListener((msg) => {
      switch (msg.type) {
        case 'progress:extracting':
          setStatus('extracting');
          break;
        case 'progress:extracted':
          setPlatform(msg.platform);
          setPageUrl(msg.url || null);
          setStatus('analyzing');
          break;
        case 'progress:metadata':
          setStatus('analyzing');
          break;
        case 'progress:personas-selected':
          setPersonas(msg.personas.map(name => ({ name, status: 'waiting', findingCount: 0 })));
          break;
        case 'progress:persona-started':
          setPersonas(prev => prev.map(p =>
            p.name === msg.persona ? { ...p, status: 'reading' } : p
          ));
          break;
        case 'progress:persona-done':
          setPersonas(prev => prev.map(p =>
            p.name === msg.persona ? { ...p, status: 'done', findingCount: msg.findingCount } : p
          ));
          break;
        case 'results:complete':
          setResult({ personaResults: msg.personaResults, aggregatedFindings: msg.aggregatedFindings });
          setStatus('complete');
          break;
        case 'feedback:applied':
          break;
        case 'error':
          setError(msg.message);
          setStatus('error');
          port.disconnect();
          portRef.current = null;
          break;
      }
    });

    if (type === 'page') {
      port.postMessage({ type: 'analyze-page' });
    } else {
      port.postMessage({ type: 'analyze-text', text });
    }
  };

  return (
    <div class="analyzer">
      <div class="header">
        <h1>First Misread</h1>
      </div>

      {status === 'idle' && (
        <div class="input-section">
          <button class="btn-primary" style={{ width: '100%' }} onClick={() => startAnalysis('page')}>
            Analyze This Page
          </button>
          {platform && <div class="platform-badge">{platform} detected</div>}
          <div class="spacer" />
          <p style={{ color: 'var(--muted)', fontSize: '12px', textAlign: 'center' }}>or paste text below</p>
          <textarea
            rows={6}
            placeholder="Paste your writing here..."
            value={pasteText}
            onInput={(e) => setPasteText(e.target.value)}
          />
          {pasteText.trim() && (
            <>
              <div class="spacer" />
              <button class="btn-secondary" onClick={() => startAnalysis('text', pasteText)}>
                Analyze Pasted Text
              </button>
            </>
          )}
        </div>
      )}

      {(status === 'extracting' || status === 'analyzing') && (
        <div>
          {status === 'extracting' && <p>Extracting text from page...</p>}
          {personas.length > 0 && <PersonaProgress personas={personas} />}
        </div>
      )}

      {status === 'complete' && result && (
        <div>
          <ResultsSummary
            aggregatedFindings={result.aggregatedFindings}
            personaResults={result.personaResults}
            onFeedback={handleFeedback}
          />
          <div class="spacer" />
          <button class="btn-secondary" onClick={() => setStatus('idle')}>
            Analyze Again
          </button>
        </div>
      )}

      {status === 'error' && (
        <div>
          <p style={{ color: 'var(--danger)' }}>{error}</p>
          <div class="spacer" />
          <button class="btn-secondary" onClick={() => setStatus('idle')}>Try Again</button>
        </div>
      )}
    </div>
  );
}
