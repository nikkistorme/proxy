import type { SessionState, Pile, Seat } from '../model/session';

export function getPile(state: SessionState, pileId: string): Pile {
  const pile = state.piles.find((p) => p.id === pileId);
  if (!pile) throw new Error(`Unknown pile: ${pileId}`);
  return pile;
}

export function withPile(state: SessionState, pile: Pile): SessionState {
  return { ...state, piles: state.piles.map((p) => (p.id === pile.id ? pile : p)) };
}

export function activeSeat(state: SessionState): Seat {
  const seat = state.seats.find((s) => s.id === state.activeSeatId);
  if (!seat) throw new Error(`Unknown active seat: ${state.activeSeatId}`);
  return seat;
}

export function checkCount(count: number): void {
  if (!Number.isInteger(count) || count < 1) throw new RangeError(`count must be a whole number of at least 1, got ${count}`);
}

export function cardName(state: SessionState, cardId: string): string {
  const card = state.cards[cardId];
  const definition = card && state.definitions[card.definitionId];
  if (!definition) throw new Error(`Unknown card: ${cardId}`);
  return definition.front.name;
}

/** "Imp", "Imp and Ogre", "Imp, Ogre and Troll". */
export function nameList(names: readonly string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
