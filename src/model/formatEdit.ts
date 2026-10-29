import { newItemId } from '../storage/storage';
import type { Format, FormatCounter, FormatPile } from './format';
import { layoutNameKey } from './layoutChoice';

/* Pure edits to a format's seats, piles and seat counters (FS-2, FS-4). Each returns a new format. Seats can't be added or removed in V1. */

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

/** A seat holds at most this many counters, so its seat bar row fits a phone (FS-4). */
export const MAX_COUNTERS = 4;
export const COUNTER_MIN = -999;
export const COUNTER_MAX = 999;

function mapSeat<T extends Format>(format: T, seatId: string, edit: (counters: FormatCounter[]) => FormatCounter[]): T {
  return { ...format, seats: format.seats.map((seat) => (seat.id === seatId ? { ...seat, counters: edit(seat.counters) } : seat)) };
}

/** Why a counter can't have this name, or undefined. Names are unique within their seat, ignoring case and outer spaces. */
export function validateCounterName(format: Format, seatId: string, counterId: string, name: string): string | undefined {
  const key = layoutNameKey(name);
  if (key === '') return 'A counter needs a name';
  const seat = format.seats.find((s) => s.id === seatId);
  const clash = seat?.counters.find((counter) => counter.id !== counterId && layoutNameKey(counter.name) === key);
  if (clash) return `There is already a counter called ${clash.name}`;
  return undefined;
}

/** Reads a starting value: a whole number with an optional leading "-" or "−". Undefined when it isn't one. */
export function parseCounterValue(text: string): number | undefined {
  const match = /^([-−]?)(\d+)$/.exec(text.trim());
  if (!match) return undefined;
  const n = Number(match[2]);
  return match[1] ? -n : n;
}

/** Why a starting value can't be used, or undefined. */
export function validateCounterValue(text: string): string | undefined {
  if (text.trim() === '') return 'A starting value is needed';
  const n = parseCounterValue(text);
  if (n === undefined) return 'The starting value must be a whole number';
  if (n < COUNTER_MIN || n > COUNTER_MAX) return `The starting value must be from ${COUNTER_MIN} to ${COUNTER_MAX}`;
  return undefined;
}

/** "Counter 3", then "Counter 4", … the first that the seat doesn't have. */
function freeCounterName(counters: FormatCounter[]): string {
  const taken = new Set(counters.map((counter) => layoutNameKey(counter.name)));
  let n = counters.length + 1;
  while (taken.has(layoutNameKey(`Counter ${n}`))) n++;
  return `Counter ${n}`;
}

/** Adds a counter at 0 to the end of a seat's counters, or returns the format as it was when the seat is full. */
export function addCounter<T extends Format>(format: T, seatId: string): { format: T; counter?: FormatCounter } {
  const seat = format.seats.find((s) => s.id === seatId);
  if (!seat || seat.counters.length >= MAX_COUNTERS) return { format };
  const counter: FormatCounter = { id: `counter-${newItemId()}`, name: freeCounterName(seat.counters), value: 0 };
  return { format: mapSeat(format, seatId, (counters) => [...counters, counter]), counter };
}

export function removeCounter<T extends Format>(format: T, seatId: string, counterId: string): T {
  return mapSeat(format, seatId, (counters) => counters.filter((counter) => counter.id !== counterId));
}

export function renameCounter<T extends Format>(format: T, seatId: string, counterId: string, name: string): T {
  return mapSeat(format, seatId, (counters) => counters.map((counter) => (counter.id === counterId ? { ...counter, name: name.trim() } : counter)));
}

export function setCounterValue<T extends Format>(format: T, seatId: string, counterId: string, value: number): T {
  return mapSeat(format, seatId, (counters) => counters.map((counter) => (counter.id === counterId ? { ...counter, value } : counter)));
}
