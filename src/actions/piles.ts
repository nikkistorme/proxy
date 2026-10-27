import type { ActionContext, ActionResult, GameState, Pile } from '../model/game';
import { clampToTable, freeSpot } from '../model/tablePlacement';
import { getPile, plural, withPile } from './helpers';

/** Pile names are unique, ignoring case and surrounding spaces. */
function pileNameKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Why a pile name can't be used, or undefined if it can. Dialogs show this
 * message, and the actions enforce the same rule.
 */
export function validatePileName(state: GameState, name: string, exceptPileId?: string): string | undefined {
  const trimmed = name.trim();
  if (trimmed === '') return 'A pile needs a name';
  const clash = state.piles.find((p) => p.id !== exceptPileId && pileNameKey(p.name) === pileNameKey(trimmed));
  if (clash) return `There is already a pile called ${clash.name}`;
  return undefined;
}

function checkName(state: GameState, name: string, exceptPileId?: string): string {
  const problem = validatePileName(state, name, exceptPileId);
  if (problem) throw new Error(problem);
  return name.trim();
}

function ownerLabel(state: GameState, pile: Pile): string {
  if (pile.ownerSeatId === undefined) return 'shared';
  return state.seats.find((s) => s.id === pile.ownerSeatId)?.name ?? pile.ownerSeatId;
}

/** SP-4: add an empty pile, owned by a seat or shared. */
export function addPile(
  state: GameState,
  args: { name: string; ownerSeatId?: string },
  context: ActionContext,
): ActionResult & { pileId: string } {
  const name = checkName(state, args.name);
  if (args.ownerSeatId !== undefined && !state.seats.some((s) => s.id === args.ownerSeatId)) {
    throw new Error(`Unknown seat: ${args.ownerSeatId}`);
  }
  // Put on the table at the first free spot, like a card (TT-4).
  const pile: Pile = { id: context.newId(), name, cardIds: [], definitionIds: [], ...freeSpot(state, context.placementColumns) };
  if (args.ownerSeatId !== undefined) pile.ownerSeatId = args.ownerSeatId;
  return {
    state: { ...state, piles: [...state.piles, pile] },
    announcement: `Added pile ${name} (${ownerLabel(state, pile)}).`,
    pileId: pile.id,
  };
}

/** SP-4: rename a pile. */
export function renamePile(state: GameState, args: { pileId: string; name: string }): ActionResult {
  const pile = getPile(state, args.pileId);
  const name = checkName(state, args.name, pile.id);
  if (name === pile.name) return { state, announcement: `${pile.name} is already called that.` };
  return { state: withPile(state, { ...pile, name }), announcement: `Renamed ${pile.name} to ${name}.` };
}

/** TT-4: move a pile to a spot on the table, kept inside the table's top and left edges. */
export function movePile(state: GameState, args: { pileId: string; position: { x: number; y: number } }): ActionResult {
  const pile = getPile(state, args.pileId);
  const { x, y } = clampToTable(args.position, 0);
  if (pile.x === x && pile.y === y) return { state, announcement: `${pile.name} is already there.` };
  return { state: withPile(state, { ...pile, x, y }), announcement: `Moved ${pile.name} on the table.` };
}

/**
 * SP-4: delete a pile. A pile that still has cards needs another pile to take
 * them; they go to its bottom in their current order.
 */
export function deletePile(state: GameState, args: { pileId: string; moveCardsToPileId?: string }): ActionResult {
  const pile = getPile(state, args.pileId);
  const remaining = state.piles.filter((p) => p.id !== pile.id);

  if (pile.cardIds.length === 0) {
    return { state: { ...state, piles: remaining }, announcement: `Deleted ${pile.name}.` };
  }
  if (args.moveCardsToPileId === undefined) throw new Error(`${pile.name} still has cards; choose a pile to move them to`);
  if (args.moveCardsToPileId === pile.id) throw new Error('Cannot move a pile\'s cards into itself');

  const target = getPile(state, args.moveCardsToPileId);
  const next = withPile({ ...state, piles: remaining }, { ...target, cardIds: [...target.cardIds, ...pile.cardIds] });
  return {
    state: next,
    announcement: `Deleted ${pile.name}. Moved ${plural(pile.cardIds.length, 'card')} to the bottom of ${target.name}.`,
  };
}
