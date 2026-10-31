import { describe, expect, it } from 'vitest';
import { DEMO_PILES } from '../demo/demoData';
import { importCards } from '../csv/importCards';
import { COOP_PVE } from '../model/format';
import { createSession, type SessionState } from '../model/session';
import { createSessionStore } from '../store/sessionStore';
import { loadDemo } from './loadDemo';
import { namesOf, testContext } from './testing';

const piles = DEMO_PILES.map((pile) => ({ pileId: pile.pileId, cardSetId: pile.cardSetId, source: { kind: 'file' as const, name: pile.fileName }, cards: importCards(pile.csv).cards, keepOrder: pile.keepOrder }));
const run = (seed = 42, state: SessionState = createSession(COOP_PVE)) => loadDemo(state, { piles }, testContext(seed));
const pileOf = (state: SessionState, id: string) => state.piles.find((p) => p.id === id);

describe('DM-5 load demo', () => {
  it('has a pile in Co-op PvE for every demo pile', () => {
    const ids = COOP_PVE.piles.map((p) => p.id);
    for (const pile of DEMO_PILES) expect(ids).toContain(pile.pileId);
  });

  it('fills all four piles with the demo card counts', () => {
    const { state } = run();
    expect(pileOf(state, 'pile-p1-main')?.cardIds).toHaveLength(30);
    expect(pileOf(state, 'pile-p2-main')?.cardIds).toHaveLength(30);
    expect(pileOf(state, 'pile-env')?.cardIds).toHaveLength(20);
    expect(pileOf(state, 'pile-board')?.cardIds).toHaveLength(6);
    expect(Object.keys(state.cardSets).sort()).toEqual(['demo-emberguard', 'demo-harbour-board', 'demo-the-fog', 'demo-tidewardens']);
  });

  it('announces the counts and the active seat', () => {
    expect(run().announcement).toBe('Demo loaded: Co-op PvE session with 86 cards in 4 piles. Player 1 is the active seat.');
  });

  it('shuffles the decks the same way from the same seed, and keeps the board in file order', () => {
    const a = run(7).state;
    const b = run(7).state;
    const order = (s: SessionState, id: string) => namesOf(s, pileOf(s, id)?.cardIds);
    expect(order(a, 'pile-p1-main')).toEqual(order(b, 'pile-p1-main'));
    expect(order(a, 'pile-env')).toEqual(order(b, 'pile-env'));
    const fileOrder = importCards(DEMO_PILES.find((p) => p.pileId === 'pile-board')?.csv ?? '').cards.flatMap((card) => Array<string>(card.qty).fill(card.front.name));
    expect(order(a, 'pile-board')).toEqual(fileOrder);
    expect(order(a, 'pile-p1-main')).not.toEqual(order(run(8).state, 'pile-p1-main'));
  });

  it('is one undo step and one log entry through the store', () => {
    const store = createSessionStore(createSession(COOP_PVE), testContext());
    const result = store.getState().dispatch((g, c) => loadDemo(g, { piles }, c));
    expect(result.results).toHaveLength(4);
    expect(store.getState().past).toHaveLength(1);
    store.getState().undo();
    expect(store.getState().session.piles.every((p) => p.cardIds.length === 0)).toBe(true);
  });
});
