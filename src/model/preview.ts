import type { CardFace } from './card';
import type { SessionState } from './session';

/** One face the layout editor's preview can show (LY-7). */
export interface PreviewFace {
  face: CardFace;
  /** What the preview calls it: the card's name, with ", back" on a back face. */
  label: string;
}

/** A loaded card set's faces, in file order, fronts before their backs. */
export interface PreviewSet {
  id: string;
  name: string;
  faces: PreviewFace[];
}

/**
 * The card sets the editor can preview (LY-7): each set loaded into a pile,
 * in pile order, with the cards still in its CSV. A double-faced card gives
 * two faces, since both are drawn through layouts. Sets with no cards are left out.
 */
export function previewCardSets(session: Pick<SessionState, 'piles' | 'definitions' | 'cardSets'>): PreviewSet[] {
  const sets: PreviewSet[] = [];
  for (const pile of session.piles) {
    const summary = pile.cardSetId === undefined ? undefined : session.cardSets[pile.cardSetId];
    if (!summary || sets.some((set) => set.id === summary.id)) continue;
    const faces: PreviewFace[] = [];
    for (const id of pile.definitionIds) {
      const definition = session.definitions[id];
      if (!definition || definition.missing) continue;
      const name = definition.front.name.trim() || 'Unnamed card';
      faces.push({ face: definition.front, label: name });
      if (definition.back) faces.push({ face: definition.back, label: `${definition.back.name.trim() || name}, back` });
    }
    if (faces.length > 0) sets.push({ id: summary.id, name: summary.name, faces });
  }
  // Two piles loaded from files with one name: tell them apart by pile.
  return sets.map((set) => {
    if (sets.filter((other) => other.name === set.name).length < 2) return set;
    const pile = session.piles.find((p) => p.cardSetId === set.id);
    return pile ? { ...set, name: `${set.name} (${pile.name})` } : set;
  });
}

/** Which card the preview shows: a set and a face in it. */
export interface PreviewPosition {
  setId?: string;
  index: number;
}

/** The set and face to show, falling back to the first set and wrapping the index into range. */
export function previewAt(sets: readonly PreviewSet[], position: PreviewPosition): { set: PreviewSet; index: number } | undefined {
  const set = sets.find((s) => s.id === position.setId) ?? sets[0];
  if (!set) return undefined;
  const count = set.faces.length;
  return { set, index: ((position.index % count) + count) % count };
}
