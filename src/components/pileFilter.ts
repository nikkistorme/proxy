import { faceValue, type CardFace } from '../model/card';
import type { SessionState } from '../model/session';

/** One card in a pile, as the viewer shows it. */
export interface PileEntry {
  cardId: string;
  /** 1 for the top card. */
  position: number;
  face: CardFace;
}

/** A column the viewer can filter by, with its values in display order. */
export interface FilterColumn {
  column: string;
  label: string;
  values: string[];
}

export interface PileQuery {
  search: string;
  /** Chosen value per column. A blank value means any. */
  filters: Record<string, string>;
}

/** Columns with this many distinct values or fewer get a filter; longer text is left to search. */
const MAX_FILTER_VALUES = 12;
/** Free-text columns are searched, never offered as filters. */
const TEXT_COLUMNS = new Set(['text', 'rules', 'rules text']);

/** Every card in a pile, top first, with its position. */
export function pileEntries(state: SessionState, pileId: string): PileEntry[] {
  const pile = state.piles.find((p) => p.id === pileId);
  return (pile?.cardIds ?? []).flatMap((cardId, index) => {
    const card = state.cards[cardId];
    const face = card && state.definitions[card.definitionId]?.front;
    return face ? [{ cardId, position: index + 1, face }] : [];
  });
}

function labelOf(column: string): string {
  return column.charAt(0).toUpperCase() + column.slice(1);
}

/**
 * SP-7: the columns worth a filter in these cards: `type` and every other
 * column with 2 to 12 different values. Values sort naturally, so 2 comes before 10.
 */
export function filterColumns(entries: readonly PileEntry[]): FilterColumn[] {
  const columns = new Set(['type']);
  for (const { face } of entries) for (const column of Object.keys(face.fields)) columns.add(column);

  return [...columns].flatMap((column) => {
    if (TEXT_COLUMNS.has(column)) return [];
    const values = new Set(entries.map(({ face }) => faceValue(face, column)).filter(Boolean));
    if (values.size < 2 || values.size > MAX_FILTER_VALUES) return [];
    const sorted = [...values].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    return [{ column, label: labelOf(column), values: sorted }];
  });
}

/**
 * SP-7: the cards whose name or any column contains the search (ignoring case
 * and surrounding spaces) and that match every chosen filter. Keeps deck order.
 */
export function filterEntries(entries: readonly PileEntry[], query: PileQuery): PileEntry[] {
  const search = query.search.trim().toLowerCase();
  const chosen = Object.entries(query.filters).filter(([, value]) => value !== '');
  return entries.filter(({ face }) => {
    if (chosen.some(([column, value]) => faceValue(face, column) !== value)) return false;
    if (!search) return true;
    const text = [face.name, face.type ?? '', ...Object.values(face.fields)];
    return text.some((value) => value.toLowerCase().includes(search));
  });
}
