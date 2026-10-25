import { cardNameKey, type CardFace, type ImportedCard } from '../model/card';
import { parseCsv } from './parseCsv';
import type { ImportProblem, RawRow } from './types';

/** Columns with a fixed meaning. Every other column goes into `fields`. */
const KNOWN_COLUMNS = new Set(['name', 'image', 'qty', 'layout', 'type', 'id', 'back_of']);

export interface ImportResult {
  cards: ImportedCard[];
  problems: ImportProblem[];
}

function known(row: RawRow, column: string): string {
  return (row.values[column] ?? '').trim();
}

function optional(value: string): string | undefined {
  return value === '' ? undefined : value;
}

function toFace(row: RawRow, name: string): CardFace {
  const fields: Record<string, string> = {};
  for (const [column, value] of Object.entries(row.values)) {
    if (!KNOWN_COLUMNS.has(column)) fields[column] = value;
  }
  const face: CardFace = { name, fields };
  const image = optional(known(row, 'image'));
  const layout = optional(known(row, 'layout'));
  const type = optional(known(row, 'type'));
  if (image !== undefined) face.image = image;
  if (layout !== undefined) face.layout = layout;
  if (type !== undefined) face.type = type;
  return face;
}

function parseQty(row: RawRow, problems: ImportProblem[]): number {
  const raw = known(row, 'qty');
  if (raw === '') return 1;
  if (/^\d+$/.test(raw)) return Number(raw);
  problems.push({ row: row.row, column: 'qty', message: `qty "${raw}" isn't a whole number. Imported 1 copy.` });
  return 1;
}

/**
 * Reads a deck CSV into cards (CD-3) and a readable list of problems (CD-4).
 * Rows with problems are skipped or repaired; every valid row still imports.
 */
export function importCards(text: string): ImportResult {
  const parsed = parseCsv(text);
  const problems: ImportProblem[] = [...parsed.problems];
  const cards: ImportedCard[] = [];

  // Every row's id, fronts and backs alike, so a back can point at a back and be told so.
  const rowById = new Map<string, number>();
  const cardById = new Map<string, ImportedCard>();
  const backRows = new Set<number>();
  const backs: { row: RawRow; name: string; target: string }[] = [];
  const firstRowByName = new Map<string, ImportedCard>();

  // Pass 1: fronts. Backs are held until every front is known, so order doesn't matter.
  for (const row of parsed.rows) {
    const name = known(row, 'name');
    if (name === '') {
      problems.push({ row: row.row, column: 'name', message: 'Missing name.' });
      continue;
    }

    let id = optional(known(row, 'id'));
    if (id !== undefined) {
      const usedOn = rowById.get(id);
      if (usedOn !== undefined) {
        problems.push({ row: row.row, column: 'id', message: `id "${id}" is already used on row ${usedOn}.` });
        id = undefined;
      } else {
        rowById.set(id, row.row);
      }
    }

    const target = optional(known(row, 'back_of'));
    if (target !== undefined) {
      backRows.add(row.row);
      backs.push({ row, name, target });
      continue;
    }

    const card: ImportedCard = { row: row.row, qty: parseQty(row, problems), front: toFace(row, name) };
    if (id !== undefined) {
      card.sourceId = id;
      cardById.set(id, card);
    }

    const first = firstRowByName.get(cardNameKey(name));
    if (first === undefined) {
      firstRowByName.set(cardNameKey(name), card);
    } else if (first.sourceId === undefined || card.sourceId === undefined) {
      problems.push({
        row: row.row,
        column: 'name',
        message: `Row ${first.row} has the same name. Re-importing will match row ${first.row}; add an id to tell them apart.`,
      });
    }
    cards.push(card);
  }

  // Pass 2: attach each back face to its front (CD-3).
  const backRowFor = new Map<ImportedCard, number>();
  for (const { row, name, target } of backs) {
    const front = cardById.get(target);
    if (front === undefined) {
      const targetRow = rowById.get(target);
      const message =
        targetRow !== undefined && backRows.has(targetRow)
          ? `Row ${targetRow} is itself a back face.`
          : `No card has id "${target}".`;
      problems.push({ row: row.row, column: 'back_of', message });
      continue;
    }
    const existing = backRowFor.get(front);
    if (existing !== undefined) {
      problems.push({
        row: row.row,
        column: 'back_of',
        message: `Card "${front.front.name}" already has a back face on row ${existing}.`,
      });
      continue;
    }
    front.back = toFace(row, name);
    backRowFor.set(front, row.row);
  }

  problems.sort((a, b) => a.row - b.row);
  return { cards, problems };
}
