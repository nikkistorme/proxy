import type { ActionResult, SessionState } from '../model/session';

/** TT-13: step a seat counter, like Life, up or down. Values can go below zero. */
export function changeSeatCounter(state: SessionState, args: { seatId: string; counterId: string; delta: number }): ActionResult {
  if (!Number.isInteger(args.delta)) throw new RangeError(`Counter steps are whole numbers, got ${args.delta}`);
  const seat = state.seats.find((s) => s.id === args.seatId);
  if (!seat) throw new Error(`Unknown seat: ${args.seatId}`);
  const counter = seat.counters.find((c) => c.id === args.counterId);
  if (!counter) throw new Error(`Unknown counter: ${args.counterId}`);
  if (args.delta === 0) return { state, announcement: `${seat.name} ${counter.name}: ${counter.value}.` };
  const value = counter.value + args.delta;
  return {
    state: {
      ...state,
      seats: state.seats.map((s) =>
        s.id === seat.id ? { ...s, counters: s.counters.map((c) => (c.id === counter.id ? { ...c, value } : c)) } : s,
      ),
    },
    announcement: `${seat.name} ${counter.name} ${counter.value} → ${value}.`,
  };
}
