import { describe, expect, it } from 'vitest';
import { COOP_PVE, PVP_1V1 } from './format';
import {
  addCounter,
  addPile,
  parseCounterValue,
  removeCounter,
  removePile,
  renameCounter,
  renamePile,
  renameSeat,
  setCounterValue,
  setPileOwner,
  setUsesDice,
  validateCounterName,
  validateCounterValue,
  validatePileName,
  validateSeatName,
} from './formatEdit';

describe('FS-2 seat names', () => {
  it('renames one seat, trimmed, and leaves the rest', () => {
    const edited = renameSeat(PVP_1V1, 'seat-p2', '  Rival ');
    expect(edited.seats.map((s) => s.name)).toEqual(['Player 1', 'Rival']);
    expect(edited.seats[1]?.id).toBe('seat-p2');
    expect(PVP_1V1.seats[1]?.name).toBe('Player 2');
  });

  it('refuses empty names and another seat’s name, ignoring case and outer spaces', () => {
    expect(validateSeatName(PVP_1V1, 'seat-p1', '   ')).toBe('A seat needs a name');
    expect(validateSeatName(PVP_1V1, 'seat-p1', ' player 2 ')).toBe('There is already a seat called Player 2');
    expect(validateSeatName(PVP_1V1, 'seat-p1', 'PLAYER 1')).toBeUndefined();
    expect(validateSeatName(PVP_1V1, 'seat-p1', 'Ann')).toBeUndefined();
  });
});

describe('FS-2 piles', () => {
  it('adds a shared pile at the end with a free default name and a pile- id', () => {
    const { format, pile } = addPile(PVP_1V1);
    expect(pile.id).toMatch(/^pile-/);
    expect(pile.name).toBe('Pile 4');
    expect(pile.ownerSeatId).toBeUndefined();
    expect(format.piles.at(-1)).toBe(pile);
    expect(format.piles).toHaveLength(4);
    const named = renamePile(format, pile.id, 'Pile 5');
    expect(addPile(named).pile.name).toBe('Pile 6');
  });

  it('removes a pile, leaving none if it was the last', () => {
    const removed = removePile(COOP_PVE, 'pile-board');
    expect(removed.piles.map((p) => p.id)).toEqual(['pile-p1-main', 'pile-p2-main', 'pile-env']);
    const none = ['pile-p1-main', 'pile-p2-main', 'pile-board'].reduce(removePile, PVP_1V1);
    expect(none.piles).toEqual([]);
  });

  it('renames a pile, trimmed', () => {
    expect(renamePile(PVP_1V1, 'pile-board', ' Table ').piles[2]?.name).toBe('Table');
  });

  it('sets an owner, or shared', () => {
    const owned = setPileOwner(PVP_1V1, 'pile-board', 'seat-p2');
    expect(owned.piles[2]?.ownerSeatId).toBe('seat-p2');
    const shared = setPileOwner(owned, 'pile-p1-main', undefined);
    expect(shared.piles[0]).toEqual({ id: 'pile-p1-main', name: 'P1 main deck' });
    expect('ownerSeatId' in (shared.piles[0] ?? {})).toBe(false);
  });

  it('refuses empty names and another pile’s name, ignoring case and outer spaces', () => {
    expect(validatePileName(PVP_1V1, 'pile-board', '')).toBe('A pile needs a name');
    expect(validatePileName(PVP_1V1, 'pile-board', ' p1 MAIN deck ')).toBe('There is already a pile called P1 main deck');
    expect(validatePileName(PVP_1V1, 'pile-board', 'board cards')).toBeUndefined();
  });
});

describe('FS-2 dice', () => {
  it('turns dice on and off', () => {
    expect(setUsesDice(PVP_1V1, false).usesDice).toBe(false);
    expect(setUsesDice(setUsesDice(PVP_1V1, false), true).usesDice).toBe(true);
  });
});

describe('FS-4 seat counters', () => {
  const p2 = (f: typeof PVP_1V1) => f.seats[1]?.counters ?? [];

  it('adds a counter at 0 with a free name and a counter- id, to one seat only', () => {
    const { format, counter } = addCounter(PVP_1V1, 'seat-p2');
    expect(counter).toMatchObject({ name: 'Counter 3', value: 0 });
    expect(counter?.id).toMatch(/^counter-/);
    expect(p2(format).map((c) => c.name)).toEqual(['Life', 'Energy', 'Counter 3']);
    expect(format.seats[0]?.counters).toHaveLength(2);
    expect(PVP_1V1.seats[1]?.counters).toHaveLength(2);
  });

  it('skips default names a seat already has', () => {
    const { format, counter } = addCounter(PVP_1V1, 'seat-p1');
    const renamed = renameCounter(format, 'seat-p1', counter?.id ?? '', 'Counter 4');
    expect(addCounter(renamed, 'seat-p1').counter?.name).toBe('Counter 5');
  });

  it('adds nothing to a seat with 4 counters', () => {
    let format = addCounter(PVP_1V1, 'seat-p1').format;
    format = addCounter(format, 'seat-p1').format;
    expect(format.seats[0]?.counters).toHaveLength(4);
    const full = addCounter(format, 'seat-p1');
    expect(full.counter).toBeUndefined();
    expect(full.format).toBe(format);
  });

  it('lets the environment seat have counters', () => {
    const { format } = addCounter(COOP_PVE, 'seat-env');
    expect(format.seats[2]?.counters).toHaveLength(1);
  });

  it('removes, renames and sets a value by id', () => {
    const removed = removeCounter(PVP_1V1, 'seat-p2', 'p2-energy');
    expect(p2(removed).map((c) => c.name)).toEqual(['Life']);
    const renamed = renameCounter(PVP_1V1, 'seat-p2', 'p2-life', '  HP ');
    expect(p2(renamed)[0]?.name).toBe('HP');
    const set = setCounterValue(PVP_1V1, 'seat-p1', 'p1-life', 30);
    expect(set.seats[0]?.counters[0]?.value).toBe(30);
    expect(set.seats[1]?.counters[0]?.value).toBe(20);
  });

  it('refuses empty names and a name the same seat has, but allows another seat’s', () => {
    expect(validateCounterName(PVP_1V1, 'seat-p1', 'p1-life', ' ')).toBe('A counter needs a name');
    expect(validateCounterName(PVP_1V1, 'seat-p1', 'p1-life', ' ENERGY ')).toBe('There is already a counter called Energy');
    expect(validateCounterName(PVP_1V1, 'seat-p1', 'p1-life', 'LIFE')).toBeUndefined();
    expect(validateCounterName(COOP_PVE, 'seat-env', 'x', 'Life')).toBeUndefined();
  });

  it('accepts whole numbers from -999 to 999, with - or −', () => {
    for (const ok of ['0', '30', '-5', '−5', ' 999 ', '-999', '007']) expect(validateCounterValue(ok), ok).toBeUndefined();
    expect(parseCounterValue('−5')).toBe(-5);
    expect(parseCounterValue('-5')).toBe(-5);
    expect(validateCounterValue('')).toBe('A starting value is needed');
    for (const bad of ['1.5', 'abc', '-', '+3', '1e2', '1 2']) expect(validateCounterValue(bad), bad).toBe('The starting value must be a whole number');
    for (const bad of ['1000', '-1000']) expect(validateCounterValue(bad), bad).toBe('The starting value must be from -999 to 999');
  });
});
