import type { ActionResult, SessionState } from '../model/session';
import { plural } from './helpers';

/**
 * FS-3: makes a seat active, which shows its hand in the hand tray. The store
 * runs it outside the undo history, since switching isn't an undo step.
 */
export function setActiveSeat(state: SessionState, args: { seatId: string }): ActionResult {
  const seat = state.seats.find((s) => s.id === args.seatId);
  if (!seat) throw new Error(`Unknown seat: ${args.seatId}`);
  const hand = seat.hasHand ? `Hand: ${plural(state.hands[seat.id]?.length ?? 0, 'card')}.` : 'It has no hand.';
  const announcement = `${seat.name} is the active seat. ${hand}`;
  if (seat.id === state.activeSeatId) return { state, announcement };
  return { state: { ...state, activeSeatId: seat.id }, announcement };
}

/** FS-3: the seat after the active one (S), or before it (Shift+S), wrapping round. */
export function neighbourSeatId(state: SessionState, step: 1 | -1): string {
  const count = state.seats.length;
  const index = state.seats.findIndex((s) => s.id === state.activeSeatId);
  return state.seats[(index + step + count) % count]?.id ?? state.activeSeatId;
}
