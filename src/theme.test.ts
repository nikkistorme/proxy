import { describe, expect, it } from 'vitest';
import { applyTheme, resolveTheme } from './theme';

/** A stand-in for window.matchMedia whose dark setting the test can flip. */
function fakeSystem(dark: boolean) {
  const listeners = new Set<() => void>();
  const query = {
    get matches() {
      return dark;
    },
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  } as unknown as MediaQueryList;
  return {
    matchMedia: () => query,
    set(next: boolean) {
      dark = next;
      listeners.forEach((listener) => listener());
    },
    listeners,
  };
}

describe('A11Y-9 dark theme', () => {
  it('follows the system setting by default', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('keeps a manual choice whatever the system says', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('sets data-theme from the system and follows changes while open', () => {
    const root = document.createElement('html');
    const system = fakeSystem(true);
    const stop = applyTheme('system', root, system.matchMedia);
    expect(root.dataset.theme).toBe('dark');

    system.set(false);
    expect(root.dataset.theme).toBe('light');

    stop();
    expect(system.listeners.size).toBe(0);
    system.set(true);
    expect(root.dataset.theme).toBe('light');
  });

  it('does not listen for system changes with a manual choice', () => {
    const root = document.createElement('html');
    const system = fakeSystem(false);
    applyTheme('dark', root, system.matchMedia);
    expect(root.dataset.theme).toBe('dark');
    expect(system.listeners.size).toBe(0);
  });
});
