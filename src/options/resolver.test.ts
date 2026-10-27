import { describe, expect, it } from 'vitest';
import { DEFAULT_OPTIONS, resolveOption } from './resolver';

describe('AR-7 options resolver', () => {
  it('returns the account value in V1', () => {
    expect(resolveOption('theme', { account: { theme: 'dark' } })).toBe('dark');
  });

  it('falls back to the default when no level sets the option', () => {
    expect(resolveOption('theme', {})).toBe(DEFAULT_OPTIONS.theme);
    expect(resolveOption('theme', { account: {} })).toBe('system');
  });

  it('checks the session, then the game, then the account', () => {
    expect(resolveOption('theme', { session: { theme: 'light' }, game: { theme: 'dark' }, account: { theme: 'system' } })).toBe('light');
    expect(resolveOption('theme', { session: {}, game: { theme: 'dark' }, account: { theme: 'light' } })).toBe('dark');
  });
});
