import type { ActionContext, ActionResult, CardInstance, CardSide, GameState, Rotation, TableEntry } from '../model/game';

/** How far a duplicate sits from its original, down and to the right (TT-11). */
export const DUPLICATE_OFFSET = 24;

function getCard(state: GameState, cardId: string): CardInstance {
  const card = state.cards[cardId];
  if (!card) throw new Error(`Unknown card: ${cardId}`);
  return card;
}

function tableIndex(state: GameState, cardId: string): number {
  const index = state.table.findIndex((entry) => entry.cardId === cardId);
  if (index < 0) throw new Error(`Card ${cardId} is not on the table`);
  return index;
}

function withEntry(state: GameState, index: number, entry: TableEntry): GameState {
  return { ...state, table: state.table.map((e, i) => (i === index ? entry : e)) };
}

/** The name of the face a card shows, as an announcement says it. A face-down card keeps its secret. */
export function shownName(state: GameState, cardId: string): string {
  const card = getCard(state, cardId);
  const definition = state.definitions[card.definitionId];
  if (!definition) throw new Error(`Unknown card: ${cardId}`);
  if (card.side === 'down') return 'a face-down card';
  return card.side === 'back' && definition.back ? definition.back.name : definition.front.name;
}

const capitalised = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** TT-5: turn a table card 90° clockwise, or counter-clockwise. */
export function rotate(state: GameState, args: { cardId: string; direction: 'clockwise' | 'counter-clockwise' }): ActionResult {
  const index = tableIndex(state, args.cardId);
  const entry = state.table[index] as TableEntry;
  const step = args.direction === 'clockwise' ? 90 : 270;
  const rotation = ((entry.rotation + step) % 360) as Rotation;
  return {
    state: withEntry(state, index, { ...entry, rotation }),
    announcement: `Rotated ${shownName(state, args.cardId)} to ${rotation}°.`,
  };
}

/** What Flip will do to a card, for its menu item and announcement (TT-6). */
export type FlipKind = 'to back' | 'to front' | 'face down' | 'face up';

export function flipKind(state: GameState, cardId: string): FlipKind {
  const card = getCard(state, cardId);
  const hasBack = state.definitions[card.definitionId]?.back !== undefined;
  if (card.side === 'down') return 'face up';
  if (!hasBack) return 'face down';
  return card.side === 'front' ? 'to back' : 'to front';
}

/**
 * TT-6: a double-faced card shows its other face; a single-faced card turns
 * face down, and back up. A face-down card always turns front up. A card whose
 * back was lost on re-import counts as single-faced.
 */
export function flip(state: GameState, args: { cardId: string }): ActionResult {
  const card = getCard(state, args.cardId);
  const kind = flipKind(state, args.cardId);
  const side: CardSide = kind === 'to back' ? 'back' : kind === 'face down' ? 'down' : 'front';
  const next: GameState = { ...state, cards: { ...state.cards, [card.id]: { ...card, side } } };
  const before = shownName(state, card.id);
  const after = shownName(next, card.id);
  const announcement =
    kind === 'face down'
      ? `Turned ${before} face down.`
      : kind === 'face up'
        ? `Turned a face-down card face up: ${after}.`
        : `Flipped ${before} ${kind === 'to back' ? 'to its back' : 'to its front'}: ${after}.`;
  return { state: next, announcement };
}

/** TT-10: draw a table card above every other card. */
export function bringToFront(state: GameState, args: { cardId: string }): ActionResult {
  const index = tableIndex(state, args.cardId);
  const name = capitalised(shownName(state, args.cardId));
  if (index === state.table.length - 1) return { state, announcement: `${name} is already in front.` };
  const entry = state.table[index] as TableEntry;
  return { state: { ...state, table: [...state.table.filter((_, i) => i !== index), entry] }, announcement: `Brought ${shownName(state, args.cardId)} to the front.` };
}

/** TT-10: draw a table card below every other card. */
export function sendToBack(state: GameState, args: { cardId: string }): ActionResult {
  const index = tableIndex(state, args.cardId);
  const name = capitalised(shownName(state, args.cardId));
  if (index === 0) return { state, announcement: `${name} is already at the back.` };
  const entry = state.table[index] as TableEntry;
  return { state: { ...state, table: [entry, ...state.table.filter((_, i) => i !== index)] }, announcement: `Sent ${shownName(state, args.cardId)} to the back.` };
}

/**
 * TT-11: copy a table card, for tokens and quick tests. The copy lands on top,
 * a little down and to the right, the same way up and turned the same way.
 */
export function duplicate(state: GameState, args: { cardId: string }, context: ActionContext): ActionResult & { cardId: string } {
  const card = getCard(state, args.cardId);
  const entry = state.table[tableIndex(state, args.cardId)] as TableEntry;
  const id = context.newId();
  return {
    cardId: id,
    state: {
      ...state,
      cards: { ...state.cards, [id]: { ...card, id, duplicate: true } },
      table: [...state.table, { ...entry, cardId: id, x: entry.x + DUPLICATE_OFFSET, y: entry.y + DUPLICATE_OFFSET }],
    },
    announcement: `Duplicated ${shownName(state, args.cardId)}.`,
  };
}

/** TT-11: remove a table card from the game. Undo brings it back. */
export function deleteCard(state: GameState, args: { cardId: string }): ActionResult {
  tableIndex(state, args.cardId);
  const name = shownName(state, args.cardId);
  const cards = Object.fromEntries(Object.entries(state.cards).filter(([id]) => id !== args.cardId));
  return {
    state: { ...state, cards, table: state.table.filter((entry) => entry.cardId !== args.cardId) },
    announcement: `Deleted ${name} from the table.`,
  };
}
