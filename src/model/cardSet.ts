import type { NewItem, StoredItem } from '../storage/storage';
import type { CardDefinition } from './card';

/** Where a card set's cards come from. Sheet URLs arrive in Phase 7. */
export interface CardSetSource {
  kind: 'file';
  /** The file name, offered for reload (SP-2). */
  name: string;
}

/** What a session keeps of each card set it loaded. Its definitions are the session's own copy (AR-4). */
export interface CardSetSummary {
  /** The card set item's UUID (AR-6). */
  id: string;
  name: string;
  source: CardSetSource;
}

/** The card definitions loaded from one CSV, saved as their own item (AR-4). */
export interface CardSet extends StoredItem {
  name: string;
  source: CardSetSource;
  /** The cards in the CSV as last loaded, with the ids the pile's copies use. */
  definitions: CardDefinition[];
}

/** A summary for a set loaded from a file, named after the file. */
export function fileCardSet(id: string, fileName: string): CardSetSummary {
  return { id, name: fileName, source: { kind: 'file', name: fileName } };
}

/**
 * The card set item to save after a load. Definitions no longer in the CSV are
 * left out: they stay in the session only, for the copies still in play.
 */
export function cardSetItem(summary: CardSetSummary, definitions: readonly CardDefinition[]): NewItem<CardSet> {
  return { ...summary, definitions: definitions.filter((definition) => !definition.missing) };
}
