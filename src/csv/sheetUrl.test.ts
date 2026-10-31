import { describe, expect, it } from 'vitest';
import { classifySheetUrl } from './sheetUrl';

const PUBLISHED = 'https://docs.google.com/spreadsheets/d/e/2PACX-abc/pub?gid=0&single=true&output=csv';

describe('CD-7 which addresses load', () => {
  it('accepts a published Google Sheets CSV link', () => {
    expect(classifySheetUrl(PUBLISHED)).toEqual({ kind: 'ok', url: PUBLISHED, fallbackName: 'Google Sheet' });
  });

  it('accepts format=csv and trims the pasted text', () => {
    expect(classifySheetUrl(`  https://docs.google.com/spreadsheets/d/abc/export?format=csv  `).kind).toBe('ok');
  });

  it('accepts any other http(s) address, named after its last path segment, else its host', () => {
    expect(classifySheetUrl('https://example.com/decks/Goblins.csv')).toEqual({ kind: 'ok', url: 'https://example.com/decks/Goblins.csv', fallbackName: 'Goblins.csv' });
    expect(classifySheetUrl('http://example.com')).toMatchObject({ kind: 'ok', fallbackName: 'example.com' });
  });

  it.each(['', 'not a url', 'example.com/deck.csv', 'ftp://example.com/deck.csv', 'javascript:alert(1)'])('refuses %j as not an address', (text) => {
    expect(classifySheetUrl(text).kind).toBe('invalid');
  });
});

describe('CD-8 Google Sheets links that are not the published CSV', () => {
  it.each([
    'https://docs.google.com/spreadsheets/d/abc/edit#gid=0',
    'https://docs.google.com/spreadsheets/d/abc/edit?usp=sharing',
    'https://docs.google.com/spreadsheets/d/abc/view',
    'https://docs.google.com/spreadsheets/d/abc/copy',
    'https://docs.google.com/spreadsheets/d/e/2PACX-abc/pubhtml',
    'https://docs.google.com/spreadsheets/d/e/2PACX-abc/pub?gid=0&single=true',
  ])('shows the how-to for %s', (link) => {
    expect(classifySheetUrl(link).kind).toBe('edit-link');
  });
});
