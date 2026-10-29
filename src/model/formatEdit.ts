import { newItemId } from '../storage/storage';
import type { Format, FormatPile } from './format';
import { layoutNameKey } from './layoutChoice';

/* Pure edits to a format's seats and piles (FS-2). Each returns a new format. Seats can't be added or removed in V1. */

/** Why a seat can't have this name, or undefined. Seat names are unique within the format, ignoring case and outer spaces. */
export function validateSeatName(format: Format, seatId: string, name: string): string | undefined {
  const key = layoutNameKey(name);
  if (key === '') return 'A seat needs a name';
  const clash = format.seats.find((seat) => seat.id !== seatId && layoutNameKey(seat.name) === key);
  if (clash) return `There is already a seat called ${clash.name}`;
  return undefined;
}

/** Why a pile can't have this name, or undefined. The same rule as piles in a session (SP-4). */
export function validatePileName(format: Format, pileId: string, name: string): string | undefined {
  const key = layoutNameKey(name);
  if (key === '') return 'A pile needs a name';
  const clash = format.piles.find((pile) => pile.id !== pileId && layoutNameKey(pile.name) === key);
  if (clash) return `There is already a pile called ${clash.name}`;
  return undefined;
}

export function renameSeat<T extends Format>(format: T, seatId: string, name: string): T {
  return { ...format, seats: format.seats.map((seat) => (seat.id === seatId ? { ...seat, name: name.trim() } : seat)) };
}

/** "Pile 4", then "Pile 5", … the first that no pile has. */
function freePileName(format: Format): string {
  const taken = new Set(format.piles.map((pile) => layoutNameKey(pile.name)));
  let n = format.piles.length + 1;
  while (taken.has(layoutNameKey(`Pile ${n}`))) n++;
  return `Pile ${n}`;
}

/** Adds a shared pile at the end, with a free default name and a new id. */
export function addPile<T extends Format>(format: T): { format: T; pile: FormatPile } {
  const pile: FormatPile = { id: `pile-${newItemId()}`, name: freePileName(format) };
  return { format: { ...format, piles: [...format.piles, pile] }, pile };
}

export function removePile<T extends Format>(format: T, pileId: string): T {
  return { ...format, piles: format.piles.filter((pile) => pile.id !== pileId) };
}

export function renamePile<T extends Format>(format: T, pileId: string, name: string): T {
  return { ...format, piles: format.piles.map((pile) => (pile.id === pileId ? { ...pile, name: name.trim() } : pile)) };
}

/** An owner of undefined makes the pile shared. */
export function setPileOwner<T extends Format>(format: T, pileId: string, ownerSeatId: string | undefined): T {
  return {
    ...format,
    piles: format.piles.map((pile) => {
      if (pile.id !== pileId) return pile;
      const shared: FormatPile = { id: pile.id, name: pile.name };
      return ownerSeatId === undefined ? shared : { ...shared, ownerSeatId };
    }),
  };
}

export function setUsesDice<T extends Format>(format: T, usesDice: boolean): T {
  return { ...format, usesDice };
}
