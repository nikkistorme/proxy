import type { ActionContext, ActionResult, Counter, GameState, TableEntry } from '../model/game';
import { shownName } from './cardActions';

/** A new counter starts at 1, the usual reason to add one. */
export const COUNTER_START = 1;

function tableEntry(state: GameState, cardId: string): { index: number; entry: TableEntry } {
  const index = state.table.findIndex((e) => e.cardId === cardId);
  const entry = state.table[index];
  if (!entry) throw new Error(`Card ${cardId} is not on the table`);
  return { index, entry };
}

function getCounter(entry: TableEntry, counterId: string): Counter {
  const counter = entry.counters?.find((c) => c.id === counterId);
  if (!counter) throw new Error(`Unknown counter: ${counterId}`);
  return counter;
}

function withCounters(state: GameState, index: number, entry: TableEntry, counters: Counter[]): GameState {
  const next: TableEntry = { ...entry, counters };
  if (counters.length === 0) delete next.counters;
  return {
    ...state,
    table: state.table.map((e, i) => (i === index ? next : e)),
  };
}

/** Counter names are unique on a card, ignoring case and surrounding spaces. */
function nameTaken(entry: TableEntry, name: string, exceptId?: string): boolean {
  const key = name.trim().toLowerCase();
  return (entry.counters ?? []).some((c) => c.id !== exceptId && c.name.trim().toLowerCase() === key);
}

/** Why a counter name can't be used on this card, or undefined if it can. */
export function counterNameProblem(state: GameState, cardId: string, name: string, exceptId?: string): string | undefined {
  if (name.trim() === '') return 'Enter a counter name.';
  if (nameTaken(tableEntry(state, cardId).entry, name, exceptId)) return `This card already has a ${name.trim()} counter.`;
  return undefined;
}

/** TT-8: add a named counter to a table card, starting at 1. */
export function addCounter(state: GameState, args: { cardId: string; name: string }, context: ActionContext): ActionResult & { counterId?: string } {
  const problem = counterNameProblem(state, args.cardId, args.name);
  if (problem) return { state, announcement: problem };
  const { index, entry } = tableEntry(state, args.cardId);
  const counter: Counter = {
    id: context.newId(),
    name: args.name.trim(),
    value: COUNTER_START,
  };
  return {
    counterId: counter.id,
    state: withCounters(state, index, entry, [...(entry.counters ?? []), counter]),
    announcement: `Added ${counter.name} ${counter.value} to ${shownName(state, args.cardId)}.`,
  };
}

/** TT-8: set a counter to a whole number. The − and + buttons step it by one. */
export function setCounter(state: GameState, args: { cardId: string; counterId: string; value: number }): ActionResult {
  if (!Number.isInteger(args.value)) throw new RangeError(`Counter values are whole numbers, got ${args.value}`);
  const { index, entry } = tableEntry(state, args.cardId);
  const counter = getCounter(entry, args.counterId);
  const announcement = `${counter.name} on ${shownName(state, args.cardId)}: ${args.value}.`;
  if (counter.value === args.value) return { state, announcement };
  const counters = (entry.counters ?? []).map((c) => (c.id === counter.id ? { ...c, value: args.value } : c));
  return { state: withCounters(state, index, entry, counters), announcement };
}

/** TT-8: rename a counter, keeping its value. */
export function renameCounter(state: GameState, args: { cardId: string; counterId: string; name: string }): ActionResult {
  const { index, entry } = tableEntry(state, args.cardId);
  const counter = getCounter(entry, args.counterId);
  const name = args.name.trim();
  if (name === counter.name) return { state, announcement: '' };
  const problem = counterNameProblem(state, args.cardId, name, counter.id);
  if (problem) return { state, announcement: problem };
  const counters = (entry.counters ?? []).map((c) => (c.id === counter.id ? { ...c, name } : c));
  return {
    state: withCounters(state, index, entry, counters),
    announcement: `Renamed ${counter.name} on ${shownName(state, args.cardId)} to ${name}.`,
  };
}

/** TT-8: take a counter off a card. Undo puts it back. */
export function removeCounter(state: GameState, args: { cardId: string; counterId: string }): ActionResult {
  const { index, entry } = tableEntry(state, args.cardId);
  const counter = getCounter(entry, args.counterId);
  const counters = (entry.counters ?? []).filter((c) => c.id !== counter.id);
  return {
    state: withCounters(state, index, entry, counters),
    announcement: `Removed ${counter.name} from ${shownName(state, args.cardId)}.`,
  };
}
