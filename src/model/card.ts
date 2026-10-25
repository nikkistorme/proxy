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
