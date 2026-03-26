import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { isOnboardingComplete } from '../shared/storage.js';
import { Onboarding } from './components/Onboarding.jsx';
import { Analyzer } from './components/Analyzer.jsx';
import { Settings } from './components/Settings.jsx';
import './styles/panel.css';

function App() {
  const [showOnboarding, setShowOnboarding] = useState(null);
  const [view, setView] = useState('analyzer');

  useEffect(() => {
    isOnboardingComplete().then(complete => setShowOnboarding(!complete));
  }, []);

  if (showOnboarding === null) return null;
  if (showOnboarding) return <Onboarding onComplete={() => setShowOnboarding(false)} />;

  if (view === 'settings') return <Settings onBack={() => setView('analyzer')} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button class="btn-secondary" style={{ padding: '4px 8px', fontSize: '16px' }}
          onClick={() => setView('settings')}>⚙</button>
      </div>
      <Analyzer />
    </div>
  );
}

render(<App />, document.getElementById('app'));
