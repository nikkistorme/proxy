import { describe, expect, it } from 'vitest';
import type { GameState } from '../model/game';
import { duplicate, flip } from './cardActions';
import { addCounter, counterNameProblem, removeCounter, renameCounter, setCounter } from './counters';
import { moveCard } from './moveCard';
import { gameWithDeck, testContext } from './testing';

/** Imp on the table; Ogre and Troll stay in the deck. */
function tableGame(): GameState {
  const game = gameWithDeck();
  return moveCard(game, { cardId: game.piles[0]?.cardIds[0] ?? '', to: { zone: 'table' } }).state;
}

const imp = (g: GameState) => g.table[0]?.cardId ?? '';

function withDamage(): { game: GameState; counterId: string } {
  const start = tableGame();
  const result = addCounter(start, { cardId: imp(start), name: ' Damage ' }, testContext());
  return { game: result.state, counterId: result.counterId ?? '' };
}

describe('TT-8 card counters', () => {
  it('adds a named counter starting at 1', () => {
    const { game, counterId } = withDamage();
    expect(game.table[0]?.counters).toEqual([{ id: counterId, name: 'Damage', value: 1 }]);
    const again = addCounter(game, { cardId: imp(game), name: '+1/+1' }, testContext());
    expect(again.announcement).toBe('Added +1/+1 1 to Imp.');
    expect(again.state.table[0]?.counters?.map((c) => c.name)).toEqual(['Damage', '+1/+1']);
  });

  it('refuses a blank name or one the card already has, ignoring case', () => {
    const { game } = withDamage();
    expect(addCounter(game, { cardId: imp(game), name: '  ' }, testContext())).toEqual({ state: game, announcement: 'Enter a counter name.' });
    const taken = addCounter(game, { cardId: imp(game), name: 'damage' }, testContext());
    expect(taken.state).toBe(game);
    expect(taken.announcement).toBe('This card already has a damage counter.');
    expect(counterNameProblem(game, imp(game), 'Shield')).toBeUndefined();
  });

  it('sets a value, including below zero, and announces it', () => {
    const { game, counterId } = withDamage();
    const three = setCounter(game, { cardId: imp(game), counterId, value: 3 });
    expect(three.state.table[0]?.counters?.[0]?.value).toBe(3);
    expect(three.announcement).toBe('Damage on Imp: 3.');
    expect(setCounter(game, { cardId: imp(game), counterId, value: -1 }).state.table[0]?.counters?.[0]?.value).toBe(-1);
    expect(setCounter(game, { cardId: imp(game), counterId, value: 1 }).state).toBe(game);
    expect(() => setCounter(game, { cardId: imp(game), counterId, value: 1.5 })).toThrow(RangeError);
  });

  it('renames a counter and keeps its value', () => {
    const { game, counterId } = withDamage();
    const renamed = renameCounter(game, { cardId: imp(game), counterId, name: 'Wounds' });
    expect(renamed.state.table[0]?.counters?.[0]).toEqual({ id: counterId, name: 'Wounds', value: 1 });
    expect(renamed.announcement).toBe('Renamed Damage on Imp to Wounds.');
    expect(renameCounter(game, { cardId: imp(game), counterId, name: ' ' }).state).toBe(game);
  });

  it('removes a counter, dropping the empty list', () => {
    const { game, counterId } = withDamage();
    const removed = removeCounter(game, { cardId: imp(game), counterId });
    expect(removed.state.table[0]).not.toHaveProperty('counters');
    expect(removed.announcement).toBe('Removed Damage from Imp.');
  });

  it('keeps a face-down card secret', () => {
    const { game, counterId } = withDamage();
    const down = flip(game, { cardId: imp(game) }).state;
    expect(setCounter(down, { cardId: imp(game), counterId, value: 2 }).announcement).toBe('Damage on a face-down card: 2.');
  });

  it('stays with the card as it moves on the table and is copied by Duplicate', () => {
    const { game } = withDamage();
    const moved = moveCard(game, { cardId: imp(game), to: { zone: 'table', position: { x: 400, y: 300 } } }).state;
    expect(moved.table[0]?.counters?.[0]?.name).toBe('Damage');
    const copied = duplicate(game, { cardId: imp(game) }, testContext());
    expect(copied.state.table[1]?.counters?.[0]?.name).toBe('Damage');
  });

  it('goes when the card leaves the table', () => {
    const { game } = withDamage();
    const toHand = moveCard(game, { cardId: imp(game), to: { zone: 'hand', seatId: 'seat-p1' } }).state;
    const back = moveCard(toHand, { cardId: imp(game), to: { zone: 'table' } }).state;
    expect(back.table[0]).not.toHaveProperty('counters');
  });

  it('only works on table cards', () => {
    const game = tableGame();
    const inDeck = game.piles[0]?.cardIds[0] ?? '';
    expect(() => addCounter(game, { cardId: inDeck, name: 'Damage' }, testContext())).toThrow('not on the table');
  });
});
