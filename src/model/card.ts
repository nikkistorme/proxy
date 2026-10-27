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
