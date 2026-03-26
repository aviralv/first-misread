import { useState } from 'preact/hooks';
import { saveSettings, completeOnboarding } from '../../shared/storage.js';
import { createClient } from '../../core/llm-client.js';

const PROVIDERS = [
  { id: 'anthropic', name: 'Anthropic', model: 'claude-sonnet-4-6', label: 'Claude' },
  { id: 'openai', name: 'OpenAI', model: 'gpt-4o', label: 'GPT-4o' },
  { id: 'google', name: 'Google', model: 'gemini-2.0-flash', label: 'Gemini' },
  { id: 'openai-compatible', name: 'Other (OpenAI-compatible)', model: '', label: 'Custom' },
];

const KEY_URLS = {
  anthropic: 'https://console.anthropic.com/settings/keys',
  openai: 'https://platform.openai.com/api-keys',
  google: 'https://aistudio.google.com/apikey',
};

export function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [provider, setProvider] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [testStatus, setTestStatus] = useState('idle');
  const [testError, setTestError] = useState(null);

  const totalSteps = 5;

  const handleProviderSelect = (p) => {
    setProvider(p);
    setModel(p.model);
  };

  const handleTestRun = async () => {
    setTestStatus('running');
    setTestError(null);

    const config = {
      apiKey,
      model: model || provider.model,
      baseUrl: baseUrl || undefined,
    };

    const client = createClient(provider.id, config);
    const result = await client.call(
      'Return JSON: {"status": "ok"}',
      'Respond with the requested JSON.',
      100,
    );

    if (result) {
      setTestStatus('success');
      await saveSettings({
        provider: provider.id,
        apiKey,
        model: model || provider.model,
        baseUrl: baseUrl || null,
      });
    } else {
      setTestStatus('error');
      setTestError('Could not connect. Check your API key and try again.');
    }
  };

  const handleDone = async () => {
    await completeOnboarding();
    onComplete();
  };

  return (
    <div class="onboarding">
      <div class="step-indicator">
        {Array.from({ length: totalSteps }, (_, i) => (
          <div class={`step-dot ${i < step ? 'done' : i === step ? 'active' : ''}`} />
        ))}
      </div>

      {step === 0 && (
        <div>
          <h1>First Misread</h1>
          <p>Find where your writing gets misunderstood — before a real reader does.</p>
          <div class="spacer" />
          <button class="btn-primary" onClick={() => setStep(1)}>Get Started</button>
        </div>
      )}

      {step === 1 && (
        <div>
          <h2>Pick your LLM provider</h2>
          <p>Your API key stays on your device. We never see it.</p>
          <div class="spacer" />
          {PROVIDERS.map(p => (
            <div
              class={`provider-option ${provider?.id === p.id ? 'selected' : ''}`}
              onClick={() => handleProviderSelect(p)}
            >
              <strong>{p.label}</strong>
              <span style={{ color: 'var(--muted)' }}>{p.name}</span>
            </div>
          ))}
          <div class="spacer" />
          <button class="btn-primary" disabled={!provider} onClick={() => setStep(2)}>
            Continue
          </button>
        </div>
      )}

      {step === 2 && (
        <div>
          <h2>Paste your API key</h2>
          {KEY_URLS[provider?.id] && (
            <p><a href={KEY_URLS[provider.id]} target="_blank" rel="noopener">Get an API key →</a></p>
          )}
          <input
            type="password"
            placeholder="API key"
            value={apiKey}
            onInput={(e) => setApiKey(e.target.value)}
          />
          {provider?.id === 'openai-compatible' && (
            <>
              <div class="spacer" />
              <input placeholder="Base URL (e.g. http://localhost:11434/v1)" value={baseUrl} onInput={(e) => setBaseUrl(e.target.value)} />
              <div class="spacer" />
              <input placeholder="Model name" value={model} onInput={(e) => setModel(e.target.value)} />
            </>
          )}
          <div class="privacy-note">
            Your key stays on your device. We never see it, store it, or transmit it to our servers. It goes directly from your browser to your LLM provider.
          </div>
          <div class="spacer" />
          <button class="btn-primary" disabled={!apiKey} onClick={() => setStep(3)}>
            Continue
          </button>
        </div>
      )}

      {step === 3 && (
        <div>
          <h2>Test your connection</h2>
          {testStatus === 'idle' && (
            <button class="btn-primary" onClick={handleTestRun}>Run Test</button>
          )}
          {testStatus === 'running' && <p>Testing connection...</p>}
          {testStatus === 'success' && (
            <div>
              <p style={{ color: 'var(--success)' }}>Connected successfully!</p>
              <div class="spacer" />
              <button class="btn-primary" onClick={() => setStep(4)}>Continue</button>
            </div>
          )}
          {testStatus === 'error' && (
            <div>
              <p style={{ color: 'var(--danger)' }}>{testError}</p>
              <div class="spacer" />
              <button class="btn-secondary" onClick={() => { setTestStatus('idle'); setStep(2); }}>
                Go Back
              </button>
            </div>
          )}
        </div>
      )}

      {step === 4 && (
        <div>
          <h1>You're set!</h1>
          <p>Open any page and click the First Misread icon to analyze your writing.</p>
          <div class="spacer" />
          <button class="btn-primary" onClick={handleDone}>Start Analyzing</button>
        </div>
      )}
    </div>
  );
}
