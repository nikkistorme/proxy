import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { memoryBackend } from './backends';
import { itemKey, SAVE_VERSION, type StorageBackend } from './storage';

const settingsKey = itemKey(import.meta.env.BASE_URL, 'guest', 'settings', 'account');

// jsdom has no matchMedia; the system here is always light.
beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.theme;
});

describe('AR-6 the app reads through the storage interface', () => {
  it('uses the swapped-in memory storage for the account settings (AR-7)', async () => {
    const backend = memoryBackend({ [settingsKey]: { id: 'account', updatedAt: '', version: SAVE_VERSION, options: { theme: 'dark' } } });
    render(<App storageBackend={backend} />);
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });
});

describe('PS-5 older saves notice', () => {
  it('says older saves were removed', async () => {
    const backend = memoryBackend({ [settingsKey]: { id: 'account', updatedAt: '', version: SAVE_VERSION - 1, options: { theme: 'dark' } } });
    render(<App storageBackend={backend} />);
    expect(await screen.findByRole('note')).toHaveTextContent('Saves from an older version of Proxy were removed.');
    expect(backend.data.has(settingsKey)).toBe(false);
    expect(document.documentElement.dataset.theme).not.toBe('dark');
  });
});

describe('PS-6 storage unavailable', () => {
  it('still works and says progress won’t be saved', async () => {
    const blocked: StorageBackend = { ...memoryBackend(), set: () => Promise.reject(new DOMException('blocked', 'SecurityError')) };
    render(<App storageBackend={blocked} />);
    expect(await screen.findByRole('note')).toHaveTextContent('progress won’t be saved');
    expect(screen.getByRole('button', { name: /^P1 main deck,/ })).toBeInTheDocument();
  });
});
