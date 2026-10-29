import { describe, expect, it } from 'vitest';
import { COOP_PVE, PVP_1V1 } from './format';
import { addPile, removePile, renamePile, renameSeat, setPileOwner, setUsesDice, validatePileName, validateSeatName } from './formatEdit';

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
