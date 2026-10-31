import { describe, expect, it } from 'vitest';
import { COOP_PVE, PVP_1V1, SOLO_PVE } from '../model/format';
import { createSession } from '../model/session';
import { createSessionStore } from '../store/sessionStore';
import { loadPile } from './loadPile';
import { draw } from './pileActions';
import { neighbourSeatId, setActiveSeat } from './seats';
import { cardsFrom, testContext } from './testing';

/** A 1v1 session with Imp, Ogre and Troll in each player's main deck. */
function pvpWithDecks() {
  const cards = cardsFrom('name\nImp\nOgre\nTroll\n');
  const context = testContext();
  let state = createSession(PVP_1V1);
  for (const pileId of ['pile-p1-main', 'pile-p2-main']) {
    state = loadPile(state, { pileId, cardSetId: `set-${pileId}`, source: { kind: 'file', name: 'deck.csv' }, cards, keepOrder: true }, context).state;
  }
  return state;
}

describe('FS-3 seat switcher', () => {
  it('makes a seat active and announces it with its hand size', () => {
    const start = draw(pvpWithDecks(), { pileId: 'pile-p1-main', count: 2 });
    const p2 = setActiveSeat(start.state, { seatId: 'seat-p2' });
    expect(p2.state.activeSeatId).toBe('seat-p2');
    expect(p2.announcement).toBe('Player 2 is the active seat. Hand: 0 cards.');
    expect(p2.state.hands).toBe(start.state.hands);
    const p1 = setActiveSeat(p2.state, { seatId: 'seat-p1' });
    expect(p1.announcement).toBe('Player 1 is the active seat. Hand: 2 cards.');
  });

  it('says the environment has no hand', () => {
    const result = setActiveSeat(createSession(SOLO_PVE), { seatId: 'seat-env' });
    expect(result.state.activeSeatId).toBe('seat-env');
    expect(result.announcement).toBe('Environment is the active seat. It has no hand.');
  });

  it('changes nothing for the seat already active and refuses unknown seats', () => {
    const start = createSession(PVP_1V1);
    const same = setActiveSeat(start, { seatId: 'seat-p1' });
    expect(same.state).toBe(start);
    expect(same.announcement).toBe('Player 1 is the active seat. Hand: 0 cards.');
    expect(() => setActiveSeat(start, { seatId: 'nope' })).toThrow('Unknown seat');
  });

  it('steps to the next and previous seat in seat bar order, wrapping round', () => {
    const coop = createSession(COOP_PVE);
    const order = coop.seats.map((s) => s.id);
    expect(neighbourSeatId(coop, 1)).toBe(order[1]);
    expect(neighbourSeatId(coop, -1)).toBe(order.at(-1));
    const last = { ...coop, activeSeatId: order.at(-1) ?? '' };
    expect(neighbourSeatId(last, 1)).toBe(order[0]);
  });

  it('isn’t an undo step, and undo still reverts a draw made after a switch', () => {
    const store = createSessionStore(pvpWithDecks(), testContext());
    store.getState().switchSeat('seat-p2');
    expect(store.getState().past).toHaveLength(0);
    expect(store.getState().announcement.text).toBe('Player 2 is the active seat. Hand: 0 cards.');
    store.getState().dispatch((s) => draw(s, { pileId: 'pile-p2-main' }));
    expect(store.getState().session.hands['seat-p2']).toHaveLength(1);
    store.getState().undo();
    expect(store.getState().session.hands['seat-p2']).toHaveLength(0);
    expect(store.getState().session.activeSeatId).toBe('seat-p2');
  });

  it('undo and redo show the hand of the seat that took the action', () => {
    const store = createSessionStore(pvpWithDecks(), testContext());
    const { dispatch, switchSeat, undo, redo } = store.getState();
    dispatch((s) => draw(s, { pileId: 'pile-p1-main' }));
    switchSeat('seat-p2');
    undo();
    expect(store.getState().session.activeSeatId).toBe('seat-p1');
    expect(store.getState().session.hands['seat-p1']).toHaveLength(0);
    switchSeat('seat-p2');
    redo();
    expect(store.getState().session.activeSeatId).toBe('seat-p1');
    expect(store.getState().session.hands['seat-p1']).toHaveLength(1);
  });

  it('leaves the redo list alone', () => {
    const store = createSessionStore(pvpWithDecks(), testContext());
    const { dispatch, switchSeat, undo } = store.getState();
    dispatch((s) => draw(s, { pileId: 'pile-p1-main' }));
    undo();
    switchSeat('seat-p2');
    expect(store.getState().future).toHaveLength(1);
  });
});
