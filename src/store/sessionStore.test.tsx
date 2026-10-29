import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { loadPile } from '../actions/loadPile';
import { draw, revealTop, shuffle } from '../actions/pileActions';
import { cardsFrom, sessionWithDeck, namesOf, testContext } from '../actions/testing';
import { LiveRegion } from '../components/LiveRegion';
import { createSession } from '../model/session';
import { PVP_1V1, SOLO_PVE } from '../model/format';
import { createSessionStore, SessionStoreProvider, HISTORY_LIMIT, LOG_LIMIT, useSessionStore } from './sessionStore';

describe('AR-2 store and live region', () => {
  it('dispatch runs an action, stores the new session and announces it', () => {
    const store = createSessionStore(sessionWithDeck(), testContext());
    const result = store.getState().dispatch((g) => draw(g, { pileId: 'pile-p1-main' }));
    expect(store.getState().session).toBe(result.state);
    expect(store.getState().announcement).toEqual({ text: 'Player 1 drew Imp from P1 main deck. 2 cards left.', id: 1 });
  });

  it('reads each announcement in a polite status region, even when the text repeats', () => {
    const store = createSessionStore(sessionWithDeck(), testContext());
    render(
      <SessionStoreProvider store={store}>
        <LiveRegion />
      </SessionStoreProvider>,
    );
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    act(() => {
      store.getState().dispatch((g) => draw(g, { pileId: 'pile-board' }));
    });
    const first = status.firstElementChild;
    expect(status).toHaveTextContent('Board cards is empty. No cards drawn.');
    act(() => {
      store.getState().dispatch((g) => draw(g, { pileId: 'pile-board' }));
    });
    expect(status).toHaveTextContent('Board cards is empty. No cards drawn.');
    expect(status.firstElementChild).not.toBe(first);
  });

  it('announces text that is not a session change', () => {
    const store = createSessionStore(sessionWithDeck(), testContext());
    const before = store.getState().session;
    store.getState().announce('Player 1 has no pile to draw from.');
    expect(store.getState().announcement).toEqual({ text: 'Player 1 has no pile to draw from.', id: 1 });
    expect(store.getState().session).toBe(before);
  });

  it('passes the visible table width to actions, so auto-placed cards fill it', () => {
    const store = createSessionStore(sessionWithDeck(), testContext());
    store.getState().setView({ columns: 2 });
    let seen: number | undefined;
    store.getState().dispatch((g, context) => {
      seen = context.placementColumns;
      return { state: g, announcement: '' };
    });
    expect(seen).toBe(2);
  });

  it('needs a provider', () => {
    function Reader() {
      useSessionStore((s) => s.session);
      return null;
    }
    expect(() => render(<Reader />)).toThrow('useSessionStore needs a SessionStoreProvider');
  });

  it('creates a live store with a Solo session when none is given', () => {
    const store = createSessionStore();
    expect(store.getState().session.seats.map((s) => s.name)).toEqual(['Player 1', 'Environment']);
  });
});

describe('TT-15 undo and redo', () => {
  const p1 = 'pile-p1-main';
  const deckOrder = (store: ReturnType<typeof createSessionStore>) =>
    namesOf(store.getState().session, store.getState().session.piles.find((p) => p.id === p1)?.cardIds);

  it('undoes and redoes an action, announcing which', () => {
    const store = createSessionStore(sessionWithDeck(), testContext());
    const start = store.getState().session;
    const drawn = store.getState().dispatch((g) => draw(g, { pileId: p1 })).state;

    store.getState().undo();
    expect(store.getState().session).toBe(start);
    expect(store.getState().announcement.text).toBe('Undone: Player 1 drew Imp from P1 main deck. 2 cards left.');

    store.getState().redo();
    expect(store.getState().session).toBe(drawn);
    expect(store.getState().announcement.text).toBe('Redone: Player 1 drew Imp from P1 main deck. 2 cards left.');
  });

  it('restores the exact order after a shuffle', () => {
    const csv = `name\n${Array.from({ length: 20 }, (_, i) => `Card ${i + 1}`).join('\n')}\n`;
    const store = createSessionStore(sessionWithDeck(csv), testContext());
    const before = deckOrder(store);
    store.getState().dispatch((g, context) => shuffle(g, { pileId: p1 }, context));
    const shuffled = deckOrder(store);
    expect(shuffled).not.toEqual(before);

    store.getState().undo();
    expect(deckOrder(store)).toEqual(before);
    store.getState().redo();
    expect(deckOrder(store)).toEqual(shuffled);
  });

  it('undoes a pile load, definitions included', () => {
    const store = createSessionStore(createSession(SOLO_PVE), testContext());
    store.getState().dispatch((g, context) =>
      loadPile(g, { pileId: p1, cardSetId: 'set-1', sourceName: 'deck.csv', cards: cardsFrom('name\nImp\n'), keepOrder: true }, context),
    );
    expect(Object.keys(store.getState().session.definitions)).toHaveLength(1);
    store.getState().undo();
    expect(store.getState().session.definitions).toEqual({});
    expect(store.getState().session.piles[0]?.cardIds).toEqual([]);
  });

  it('steps back through several actions in order', () => {
    const store = createSessionStore(sessionWithDeck(), testContext());
    store.getState().dispatch((g) => draw(g, { pileId: p1 }));
    store.getState().dispatch((g) => draw(g, { pileId: p1 }));
    expect(store.getState().session.hands['seat-p1']).toHaveLength(2);
    store.getState().undo();
    expect(store.getState().session.hands['seat-p1']).toHaveLength(1);
    store.getState().undo();
    expect(store.getState().session.hands['seat-p1']).toHaveLength(0);
    store.getState().redo();
    store.getState().redo();
    expect(store.getState().session.hands['seat-p1']).toHaveLength(2);
  });

  it('a new action clears what could be redone', () => {
    const store = createSessionStore(sessionWithDeck(), testContext());
    store.getState().dispatch((g) => draw(g, { pileId: p1 }));
    store.getState().undo();
    expect(store.getState().future).toHaveLength(1);
    store.getState().dispatch((g) => revealTop(g, { pileId: p1 }));
    expect(store.getState().future).toEqual([]);
    store.getState().redo();
    expect(store.getState().announcement.text).toBe('Nothing to redo.');
  });

  it('an action that changes nothing adds no step and keeps redo', () => {
    const store = createSessionStore(sessionWithDeck(), testContext());
    store.getState().dispatch((g) => draw(g, { pileId: p1 }));
    store.getState().undo();
    store.getState().dispatch((g) => draw(g, { pileId: 'pile-board' }));
    expect(store.getState().announcement.text).toBe('Board cards is empty. No cards drawn.');
    expect(store.getState().past).toEqual([]);
    expect(store.getState().future).toHaveLength(1);
  });

  it('announces when there is nothing to undo or redo, without changing the session', () => {
    const store = createSessionStore(sessionWithDeck(), testContext());
    const start = store.getState().session;
    store.getState().undo();
    expect(store.getState().announcement.text).toBe('Nothing to undo.');
    store.getState().redo();
    expect(store.getState().announcement.text).toBe('Nothing to redo.');
    expect(store.getState().session).toBe(start);
  });

  it(`keeps the last ${HISTORY_LIMIT} steps`, () => {
    const store = createSessionStore(sessionWithDeck(), testContext());
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) store.getState().dispatch((g, context) => shuffle(g, { pileId: p1 }, context));
    expect(store.getState().past).toHaveLength(HISTORY_LIMIT);
    for (let i = 0; i < HISTORY_LIMIT; i++) store.getState().undo();
    expect(store.getState().announcement.text).toMatch(/^Undone: /);
    store.getState().undo();
    expect(store.getState().announcement.text).toBe('Nothing to undo.');
  });
});

describe('TT-14 rolls in the session log', () => {
  it('logs and announces a roll, with the latest kept for Dice & coins', () => {
    const store = createSessionStore(createSession(SOLO_PVE), testContext());
    const first = store.getState().roll('d20');
    store.getState().roll('Coin');
    const { log, lastRoll, announcement } = store.getState();
    expect(log.map((e) => e.text)).toEqual([first.announcement.slice(0, -1), expect.stringMatching(/^Flipped a coin: (heads|tails)$/)]);
    expect(lastRoll?.die).toBe('Coin');
    expect(lastRoll?.id).toBe(2);
    expect(announcement.text).toMatch(/^Flipped a coin: (heads|tails)\.$/);
  });

  it('is not an undo step, and undo leaves the log alone', () => {
    const store = createSessionStore(sessionWithDeck(), testContext());
    store.getState().dispatch((g) => draw(g, { pileId: 'pile-p1-main' }));
    store.getState().roll('d6');
    expect(store.getState().past).toHaveLength(1);
    store.getState().undo();
    expect(store.getState().announcement.text).toBe('Undone: Player 1 drew Imp from P1 main deck. 2 cards left.');
    expect(store.getState().log).toHaveLength(1);
  });

  it(`keeps the last ${LOG_LIMIT} entries`, () => {
    const store = createSessionStore(createSession(SOLO_PVE), testContext());
    for (let i = 0; i < LOG_LIMIT + 5; i++) store.getState().roll('d4');
    const { log } = store.getState();
    expect(log).toHaveLength(LOG_LIMIT);
    expect(log[0]?.id).toBe(6);
    expect(log.at(-1)?.id).toBe(LOG_LIMIT + 5);
  });
});

describe('SP-1 startSession', () => {
  it('replaces the session and clears history, log and transient state', () => {
    const store = createSessionStore(sessionWithDeck(), testContext());
    store.getState().dispatch((g) => draw(g, { pileId: 'pile-p1-main' }));
    store.getState().undo();
    store.getState().roll('d6');
    store.getState().showToast('x');
    store.getState().startSession(PVP_1V1);
    const state = store.getState();
    expect(state.session.formatId).toBe(PVP_1V1.id);
    expect(Object.keys(state.session.cards)).toHaveLength(0);
    expect([state.past, state.future, state.log]).toEqual([[], [], []]);
    expect([state.lastRoll, state.toast, state.placing, state.drag]).toEqual([undefined, undefined, undefined, undefined]);
    expect(state.announcement.text).toBe('New 1v1 PvP session started. Player 1 is the active seat.');
  });

  it('can start silently', () => {
    const store = createSessionStore(createSession(SOLO_PVE), testContext());
    store.getState().startSession(PVP_1V1, { silent: true });
    expect(store.getState().announcement.text).toBe('');
  });
});

describe('PS-1 session id', () => {
  it('gives every store and every started session a new id', () => {
    const a = createSessionStore(createSession(SOLO_PVE), testContext());
    const b = createSessionStore(createSession(SOLO_PVE), testContext());
    expect(a.getState().sessionId).not.toBe(b.getState().sessionId);
    const before = a.getState().sessionId;
    a.getState().startSession(PVP_1V1);
    expect(a.getState().sessionId).not.toBe(before);
  });
});

describe('PS-2 restore a saved session', () => {
  it('loads the state, log, zoom and snap with an id, and no undo history', () => {
    const store = createSessionStore(sessionWithDeck(), testContext());
    store.getState().dispatch((g) => draw(g, { pileId: 'pile-p1-main' }));
    store.getState().roll('d6');
    store.getState().setView({ columns: 7 });
    const announced = store.getState().announcement;
    const saved = sessionWithDeck('name\nAnt\n');
    const log = [{ id: 1, text: 'Rolled a d6: 4', at: 5 }];
    store.getState().restoreSession({ id: 'saved-1', session: saved, log, zoom: 1.5, snap: true });
    const state = store.getState();
    expect(state.session).toBe(saved);
    expect(state.sessionId).toBe('saved-1');
    expect(state.log).toBe(log);
    expect(state.view).toEqual({ zoom: 1.5, snap: true, columns: 7 });
    expect([state.past, state.future, state.lastRoll]).toEqual([[], [], undefined]);
    expect(state.announcement).toBe(announced);
    state.undo();
    expect(store.getState().session).toBe(saved);
  });
});
