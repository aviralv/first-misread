import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getSettings, saveSettings, isOnboardingComplete, completeOnboarding } from '../src/shared/storage.js';

const mockStorage = {};

beforeEach(() => {
  Object.keys(mockStorage).forEach(k => delete mockStorage[k]);

  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: vi.fn((keys) => Promise.resolve(
          Array.isArray(keys)
            ? Object.fromEntries(keys.map(k => [k, mockStorage[k]]))
            : { [keys]: mockStorage[keys] }
        )),
        set: vi.fn((obj) => {
          Object.assign(mockStorage, obj);
          return Promise.resolve();
        }),
      },
    },
  });
});

describe('settings', () => {
  it('saves and retrieves settings', async () => {
    await saveSettings({ provider: 'anthropic', apiKey: 'sk-test', model: 'claude-sonnet-4-6' });
    const settings = await getSettings();
    expect(settings.provider).toBe('anthropic');
    expect(settings.apiKey).toBe('sk-test');
  });
});

describe('onboarding', () => {
  it('returns false before completion', async () => {
    expect(await isOnboardingComplete()).toBe(false);
  });

  it('returns true after completion', async () => {
    await completeOnboarding();
    expect(await isOnboardingComplete()).toBe(true);
  });
});
