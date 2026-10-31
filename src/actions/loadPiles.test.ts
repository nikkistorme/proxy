import { describe, expect, it } from 'vitest';
import { SOLO_PVE } from '../model/format';
import { createSession } from '../model/session';
import { createSessionStore } from '../store/sessionStore';
import { loadPiles } from './loadPiles';
import { cardsFrom, testContext } from './testing';

const url = (name: string) => ({ kind: 'url' as const, name, url: `https://example.com/${name}.csv`, fetchedAt: 1000 });
const main = (csv: string) => ({ pileId: 'pile-p1-main', cardSetId: 'set-a', source: url('a'), cards: cardsFrom(csv), keepOrder: true });
const env = (csv: string) => ({ pileId: 'pile-env', cardSetId: 'set-b', source: url('b'), cards: cardsFrom(csv), keepOrder: true });

describe('CD-12 load several piles', () => {
  it('loads each pile and returns each merge', () => {
    const result = loadPiles(createSession(SOLO_PVE), { loads: [main('name\nImp\nOgre\n'), env('name\nStorm\n')], failed: [], verb: 'Loaded' }, testContext());
    const sizes = Object.fromEntries(result.state.piles.map((p) => [p.id, p.cardIds.length]));
    expect(sizes).toMatchObject({ 'pile-p1-main': 2, 'pile-env': 1, 'pile-board': 0 });
    expect(result.results.map((r) => r.merge.added.length)).toEqual([2, 1]);
    expect(Object.keys(result.state.cardSets).sort()).toEqual(['set-a', 'set-b']);
  });

  it('announces how many sheets loaded and names the failures', () => {
    const state = createSession(SOLO_PVE);
    expect(loadPiles(state, { loads: [main('name\nImp\n'), env('name\nStorm\n')], failed: ['Board cards'], verb: 'Loaded' }, testContext()).announcement).toBe(
      'Loaded 2 of 3 sheets. Failed: Board cards.',
    );
    expect(loadPiles(state, { loads: [main('name\nImp\n')], failed: [], verb: 'Reloaded' }, testContext()).announcement).toBe('Reloaded 1 of 1 sheet.');
  });

  it('is one undo step and one announcement through the store', () => {
    const store = createSessionStore(createSession(SOLO_PVE), testContext());
    store.getState().dispatch((g, c) => loadPiles(g, { loads: [main('name\nImp\n'), env('name\nStorm\n')], failed: [], verb: 'Loaded' }, c));
    expect(store.getState().past).toHaveLength(1);
    store.getState().undo();
    expect(store.getState().session.piles.every((p) => p.cardIds.length === 0)).toBe(true);
  });
});
