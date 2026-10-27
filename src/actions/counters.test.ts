import { describe, expect, it } from 'vitest';
import type { SessionState } from '../model/session';
import { duplicate, flip } from './cardActions';
import { addCounter, counterNameProblem, removeCounter, renameCounter, setCounter } from './counters';
import { moveCard } from './moveCard';
import { sessionWithDeck, testContext } from './testing';

/** Imp on the table; Ogre and Troll stay in the deck. */
function tableSession(): SessionState {
  const session = sessionWithDeck();
  return moveCard(session, { cardId: session.piles[0]?.cardIds[0] ?? '', to: { zone: 'table' } }).state;
}

const imp = (g: SessionState) => g.table[0]?.cardId ?? '';

function withDamage(): { session: SessionState; counterId: string } {
  const start = tableSession();
  const result = addCounter(start, { cardId: imp(start), name: ' Damage ' }, testContext());
  return { session: result.state, counterId: result.counterId ?? '' };
}

describe('TT-8 card counters', () => {
  it('adds a named counter starting at 1', () => {
    const { session, counterId } = withDamage();
    expect(session.table[0]?.counters).toEqual([{ id: counterId, name: 'Damage', value: 1 }]);
    const again = addCounter(session, { cardId: imp(session), name: '+1/+1' }, testContext());
    expect(again.announcement).toBe('Added +1/+1 1 to Imp.');
    expect(again.state.table[0]?.counters?.map((c) => c.name)).toEqual(['Damage', '+1/+1']);
  });

  it('refuses a blank name or one the card already has, ignoring case', () => {
    const { session } = withDamage();
    expect(addCounter(session, { cardId: imp(session), name: '  ' }, testContext())).toEqual({ state: session, announcement: 'Enter a counter name.' });
    const taken = addCounter(session, { cardId: imp(session), name: 'damage' }, testContext());
    expect(taken.state).toBe(session);
    expect(taken.announcement).toBe('This card already has a damage counter.');
    expect(counterNameProblem(session, imp(session), 'Shield')).toBeUndefined();
  });

  it('sets a value, including below zero, and announces it', () => {
    const { session, counterId } = withDamage();
    const three = setCounter(session, { cardId: imp(session), counterId, value: 3 });
    expect(three.state.table[0]?.counters?.[0]?.value).toBe(3);
    expect(three.announcement).toBe('Damage on Imp: 3.');
    expect(setCounter(session, { cardId: imp(session), counterId, value: -1 }).state.table[0]?.counters?.[0]?.value).toBe(-1);
    expect(setCounter(session, { cardId: imp(session), counterId, value: 1 }).state).toBe(session);
    expect(() => setCounter(session, { cardId: imp(session), counterId, value: 1.5 })).toThrow(RangeError);
  });

  it('renames a counter and keeps its value', () => {
    const { session, counterId } = withDamage();
    const renamed = renameCounter(session, { cardId: imp(session), counterId, name: 'Wounds' });
    expect(renamed.state.table[0]?.counters?.[0]).toEqual({ id: counterId, name: 'Wounds', value: 1 });
    expect(renamed.announcement).toBe('Renamed Damage on Imp to Wounds.');
    expect(renameCounter(session, { cardId: imp(session), counterId, name: ' ' }).state).toBe(session);
  });

  it('removes a counter, dropping the empty list', () => {
    const { session, counterId } = withDamage();
    const removed = removeCounter(session, { cardId: imp(session), counterId });
    expect(removed.state.table[0]).not.toHaveProperty('counters');
    expect(removed.announcement).toBe('Removed Damage from Imp.');
  });

  it('keeps a face-down card secret', () => {
    const { session, counterId } = withDamage();
    const down = flip(session, { cardId: imp(session) }).state;
    expect(setCounter(down, { cardId: imp(session), counterId, value: 2 }).announcement).toBe('Damage on a face-down card: 2.');
  });

  it('stays with the card as it moves on the table and is copied by Duplicate', () => {
    const { session } = withDamage();
    const moved = moveCard(session, { cardId: imp(session), to: { zone: 'table', position: { x: 400, y: 300 } } }).state;
    expect(moved.table[0]?.counters?.[0]?.name).toBe('Damage');
    const copied = duplicate(session, { cardId: imp(session) }, testContext());
    expect(copied.state.table[1]?.counters?.[0]?.name).toBe('Damage');
  });

  it('goes when the card leaves the table', () => {
    const { session } = withDamage();
    const toHand = moveCard(session, { cardId: imp(session), to: { zone: 'hand', seatId: 'seat-p1' } }).state;
    const back = moveCard(toHand, { cardId: imp(session), to: { zone: 'table' } }).state;
    expect(back.table[0]).not.toHaveProperty('counters');
  });

  it('only works on table cards', () => {
    const session = tableSession();
    const inDeck = session.piles[0]?.cardIds[0] ?? '';
    expect(() => addCounter(session, { cardId: inDeck, name: 'Damage' }, testContext())).toThrow('not on the table');
  });
});
