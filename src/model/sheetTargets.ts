import type { Format } from './format';
import type { SessionState } from './session';

/** A pile and the address its sheet is fetched from (CD-12). */
export interface SheetTarget {
  pileId: string;
  pileName: string;
  url: string;
}

/** The piles a new session fetches from its format's default URLs, in format order (CD-12). */
export function startTargets(format: Format): SheetTarget[] {
  return format.piles.flatMap((pile) => (pile.sheetUrl ? [{ pileId: pile.id, pileName: pile.name, url: pile.sheetUrl }] : []));
}

/**
 * What Reload all fetches (CD-12): piles whose card set came from a URL, and
 * piles with no card set yet whose format pile has a default URL, so a pile
 * that failed at the start can be retried, even after a reload. Piles loaded
 * from a file are never touched.
 */
export function reloadAllTargets(session: SessionState, format: Format): SheetTarget[] {
  return session.piles.flatMap((pile): SheetTarget[] => {
    const source = pile.cardSetId ? session.cardSets[pile.cardSetId]?.source : undefined;
    if (source?.kind === 'url') return [{ pileId: pile.id, pileName: pile.name, url: source.url }];
    const url = pile.cardSetId === undefined ? format.piles.find((p) => p.id === pile.id)?.sheetUrl : undefined;
    return url ? [{ pileId: pile.id, pileName: pile.name, url }] : [];
  });
}
