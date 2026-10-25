import { cardNameKey, type CardDefinition, type ImportedCard } from './card';

export interface MergeResult {
  /** Imported cards in file order, then definitions no longer in the CSV. */
  definitions: CardDefinition[];
  /** Ids of definitions created by this import. */
  added: string[];
  /** Ids of existing definitions that matched an imported card and took its data. */
  updated: string[];
  /** Ids of definitions not in this import. They're kept, flagged `missing`. */
  missing: string[];
}

/**
 * Merges a fresh import into a pile's existing definitions (CD-5).
 *
 * Matched definitions keep their id and take the new data, so every table card
 * that references them updates in place without moving. Matching is by CSV id,
 * else by name; two cards with different CSV ids never match.
 */
export function mergeImport(
  existing: readonly CardDefinition[],
  imported: readonly ImportedCard[],
  newId: () => string,
): MergeResult {
  const matchFor = new Map<ImportedCard, CardDefinition>();
  const taken = new Set<CardDefinition>();

  const bySourceId = new Map<string, CardDefinition>();
  for (const definition of existing) {
    if (definition.sourceId !== undefined) bySourceId.set(definition.sourceId, definition);
  }
  for (const card of imported) {
    const match = card.sourceId === undefined ? undefined : bySourceId.get(card.sourceId);
    if (match !== undefined && !taken.has(match)) {
      matchFor.set(card, match);
      taken.add(match);
    }
  }

  // Name matches go in file order, so duplicate names pair up first with first.
  for (const card of imported) {
    if (matchFor.has(card)) continue;
    const key = cardNameKey(card.front.name);
    const match = existing.find(
      (definition) =>
        !taken.has(definition) &&
        cardNameKey(definition.front.name) === key &&
        (card.sourceId === undefined || definition.sourceId === undefined),
    );
    if (match !== undefined) {
      matchFor.set(card, match);
      taken.add(match);
    }
  }

  const added: string[] = [];
  const updated: string[] = [];
  const definitions: CardDefinition[] = imported.map((card) => {
    const match = matchFor.get(card);
    const id = match?.id ?? newId();
    (match ? updated : added).push(id);
    return { ...card, id };
  });

  const missing: string[] = [];
  for (const definition of existing) {
    if (taken.has(definition)) continue;
    missing.push(definition.id);
    definitions.push({ ...definition, missing: true });
  }

  return { definitions, added, updated, missing };
}
