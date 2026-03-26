export async function getSettings() {
  const result = await chrome.storage.local.get([
    'provider', 'apiKey', 'baseUrl', 'model', 'onboardingComplete', 'preferences',
  ]);
  return {
    provider: result.provider || null,
    apiKey: result.apiKey || null,
    baseUrl: result.baseUrl || null,
    model: result.model || null,
    onboardingComplete: result.onboardingComplete || false,
    preferences: result.preferences || { includeRewrites: false },
  };
}

export async function saveSettings(settings) {
  await chrome.storage.local.set(settings);
}

export async function isOnboardingComplete() {
  const result = await chrome.storage.local.get('onboardingComplete');
  return result.onboardingComplete === true;
}

export async function completeOnboarding() {
  await chrome.storage.local.set({ onboardingComplete: true });
}
