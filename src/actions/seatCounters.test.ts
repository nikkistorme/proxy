import { describe, expect, it } from 'vitest';
import { createSession } from '../model/session';
import { SOLO_PVE } from '../model/format';
import { createSessionStore } from '../store/sessionStore';
import { changeSeatCounter } from './seatCounters';
import { testContext } from './testing';

const life = { seatId: 'seat-p1', counterId: 'p1-life' };

describe('TT-13 seat counters', () => {
  it('starts Player 1 on Life 20 and Energy 0 in the Solo preset', () => {
    const [p1, env] = createSession(SOLO_PVE).seats;
    expect(p1?.counters.map((c) => [c.name, c.value])).toEqual([
      ['Life', 20],
      ['Energy', 0],
    ]);
    expect(env?.counters).toEqual([]);
  });

  it('steps a counter and announces the change', () => {
    const start = createSession(SOLO_PVE);
    const down = changeSeatCounter(start, { ...life, delta: -1 });
    expect(down.state.seats[0]?.counters[0]?.value).toBe(19);
    expect(down.announcement).toBe('Player 1 Life 20 → 19.');
    expect(start.seats[0]?.counters[0]?.value).toBe(20);
    const up = changeSeatCounter(down.state, { ...life, delta: 1 });
    expect(up.state.seats[0]?.counters[0]?.value).toBe(20);
  });

  it('goes below zero and leaves the other seats and counters alone', () => {
    const start = createSession(SOLO_PVE);
    const below = changeSeatCounter(start, { seatId: 'seat-p1', counterId: 'p1-energy', delta: -1 });
    expect(below.state.seats[0]?.counters.map((c) => c.value)).toEqual([20, -1]);
    expect(below.state.seats[1]).toBe(start.seats[1]);
  });

  it('changes nothing for a zero step and refuses part steps or unknown ids', () => {
    const start = createSession(SOLO_PVE);
    expect(changeSeatCounter(start, { ...life, delta: 0 }).state).toBe(start);
    expect(() => changeSeatCounter(start, { ...life, delta: 0.5 })).toThrow(RangeError);
    expect(() => changeSeatCounter(start, { seatId: 'seat-x', counterId: 'p1-life', delta: 1 })).toThrow();
    expect(() => changeSeatCounter(start, { seatId: 'seat-p1', counterId: 'nope', delta: 1 })).toThrow();
  });

  it('makes each step one undo step', () => {
    const store = createSessionStore(createSession(SOLO_PVE), testContext());
    store.getState().dispatch((g) => changeSeatCounter(g, { ...life, delta: -1 }));
    store.getState().dispatch((g) => changeSeatCounter(g, { ...life, delta: -1 }));
    expect(store.getState().session.seats[0]?.counters[0]?.value).toBe(18);
    store.getState().undo();
    expect(store.getState().session.seats[0]?.counters[0]?.value).toBe(19);
    expect(store.getState().announcement.text).toBe('Undone: Player 1 Life 19 → 18.');
  });
});
