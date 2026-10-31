import { describe, expect, it } from 'vitest';
import { loadPile } from '../actions/loadPile';
import { cardsFrom, testContext } from '../actions/testing';
import { SOLO_PVE, type Format } from './format';
import { createSession } from './session';
import { reloadAllTargets, startTargets } from './sheetTargets';

const A = 'https://example.com/a.csv';
const B = 'https://example.com/b.csv';
const format: Format = { ...SOLO_PVE, piles: SOLO_PVE.piles.map((p) => (p.id === 'pile-p1-main' ? { ...p, sheetUrl: A } : p.id === 'pile-env' ? { ...p, sheetUrl: B } : p)) };

describe('CD-12 sheet targets', () => {
  it('a start fetches every format pile with a URL, in format order', () => {
    expect(startTargets(format)).toEqual([
      { pileId: 'pile-p1-main', pileName: 'P1 main deck', url: A },
      { pileId: 'pile-env', pileName: 'Environment deck', url: B },
    ]);
    expect(startTargets(SOLO_PVE)).toEqual([]);
  });

  it('Reload all retries empty piles with a format URL', () => {
    expect(reloadAllTargets(createSession(format), format).map((t) => t.pileId)).toEqual(['pile-p1-main', 'pile-env']);
  });

  it('Reload all uses the URL a pile was loaded from, not the format default', () => {
    const state = loadPile(createSession(format), { pileId: 'pile-p1-main', cardSetId: 's', source: { kind: 'url', name: 'x', url: 'https://other.example/x.csv', fetchedAt: 1 }, cards: cardsFrom('name\nImp\n') }, testContext()).state;
    expect(reloadAllTargets(state, format)[0]?.url).toBe('https://other.example/x.csv');
  });

  it('Reload all skips a pile loaded from a file, even if its format has a URL', () => {
    const state = loadPile(createSession(format), { pileId: 'pile-p1-main', cardSetId: 's', source: { kind: 'file', name: 'x.csv' }, cards: cardsFrom('name\nImp\n') }, testContext()).state;
    expect(reloadAllTargets(state, format).map((t) => t.pileId)).toEqual(['pile-env']);
  });

  it('has no target when no pile has a URL, so the menu item is hidden (UI-4)', () => {
    expect(reloadAllTargets(createSession(SOLO_PVE), SOLO_PVE)).toEqual([]);
  });
});
