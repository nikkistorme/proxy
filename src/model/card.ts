/** One side of a card, as read from a CSV row. */
export interface CardFace {
  /** Card name; also the art's alt text. */
  name: string;
  /** URL of the card art. */
  image?: string;
  /** Name of the layout to render with. */
  layout?: string;
  /** Fallback for choosing a layout when `layout` is blank. */
  type?: string;
  /** Every other column, keyed by normalised column name, with its exact text. */
  fields: Record<string, string>;
}

/**
 * A card read from a deck CSV. It has no app id yet: those are assigned when
 * an import is merged into a pile, so they stay stable across re-imports.
 */
export interface ImportedCard {
  /** Spreadsheet row of the front face. */
  row: number;
  /** The CSV `id` column, when set. */
  sourceId?: string;
  /** Copies in the deck. */
  qty: number;
  front: CardFace;
  /** Second face of a double-faced card (CD-3). */
  back?: CardFace;
}

/** A card in a pile's deck. Table cards reference it by `id` (AR-4). */
export interface CardDefinition extends ImportedCard {
  /** App id, kept stable across re-imports (CD-5). */
  id: string;
  /** Set when the card is no longer in the pile's CSV. Copies in play still render. */
  missing?: true;
}

/** Cards with the same name key are treated as the same card when there's no id. */
export function cardNameKey(name: string): string {
  return name.trim().toLowerCase();
}

/** A column's value on a face, trimmed. `name`, `image`, `layout` and `type` are named columns; the rest are fields. */
export function faceValue(face: CardFace, column: string): string {
  switch (column) {
    case 'name':
      return face.name.trim();
    case 'image':
    case 'layout':
    case 'type':
      return face[column]?.trim() ?? '';
    default:
      return face.fields[column]?.trim() ?? '';
  }
}

/** Every column the cards have a value in, front or back, sorted: the editor's column suggestions (LY-3). */
export function cardColumns(cards: Iterable<ImportedCard>): string[] {
  const columns = new Set<string>();
  for (const card of cards) {
    for (const face of card.back ? [card.front, card.back] : [card.front]) {
      for (const column of ['name', 'image', 'type', 'layout'] as const) if (face[column]?.trim()) columns.add(column);
      for (const [column, value] of Object.entries(face.fields)) if (value.trim()) columns.add(column);
    }
  }
  return [...columns].sort((a, b) => a.localeCompare(b));
}

/** Every card type the cards have, front or back, once each ignoring case and outer spaces, sorted: the types to map to layouts (LY-8). */
export function cardTypes(cards: Iterable<ImportedCard>): string[] {
  const types = new Map<string, string>();
  for (const card of cards) {
    for (const face of card.back ? [card.front, card.back] : [card.front]) {
      const type = face.type?.trim();
      if (type && !types.has(type.toLowerCase())) types.set(type.toLowerCase(), type);
    }
  }
  return [...types.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}
