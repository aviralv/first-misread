import { useState, useEffect } from 'preact/hooks';
import { getSettings, saveSettings } from '../../shared/storage.js';

const PROVIDERS = [
  { id: 'anthropic', name: 'Anthropic (Claude)' },
  { id: 'openai', name: 'OpenAI (GPT)' },
  { id: 'google', name: 'Google (Gemini)' },
  { id: 'openai-compatible', name: 'Other (OpenAI-compatible)' },
];

export function Settings({ onBack }) {
  const [settings, setSettings] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { getSettings().then(setSettings); }, []);

  if (!settings) return null;

  const update = (key, value) => {
    setSettings({ ...settings, [key]: value });
    setSaved(false);
  };

  const handleSave = async () => {
    await saveSettings(settings);
    setSaved(true);
  };

  return (
    <div class="settings">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button class="btn-secondary" onClick={onBack}>← Back</button>
        <h2 style={{ margin: 0 }}>Settings</h2>
      </div>

      <label>Provider</label>
      <select value={settings.provider || ''} onChange={(e) => update('provider', e.target.value)}>
        {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>

      <div class="spacer" />
      <label>API Key</label>
      <input type="password" value={settings.apiKey || ''} onInput={(e) => update('apiKey', e.target.value)} />

      <div class="spacer" />
      <label>Model</label>
      <input value={settings.model || ''} onInput={(e) => update('model', e.target.value)} />

      {(settings.provider === 'openai-compatible' || settings.baseUrl) && (
        <>
          <div class="spacer" />
          <label>Base URL</label>
          <input value={settings.baseUrl || ''} onInput={(e) => update('baseUrl', e.target.value)} />
        </>
      )}

      <div class="privacy-note">
        Your key stays on your device. We never see it, store it, or transmit it to our servers.
      </div>

      <div class="spacer" />
      <button class="btn-primary" onClick={handleSave}>
        {saved ? '✓ Saved' : 'Save Settings'}
      </button>
    </div>
  );
}
