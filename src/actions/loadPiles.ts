import type { SessionState, ActionContext, ActionResult } from '../model/session';
import { loadPile, type LoadPileArgs, type LoadPileResult } from './loadPile';
import { plural } from './helpers';

export interface LoadPilesArgs {
  /** The piles whose fetch worked, in format order. */
  loads: readonly LoadPileArgs[];
  /** Names of the piles whose fetch failed, for the announcement. */
  failed: readonly string[];
  /** "Loaded" at a session start, "Reloaded" for Reload all. */
  verb: 'Loaded' | 'Reloaded';
}

/** "Loaded 2 of 3 sheets. Failed: P2 main deck." Also used when every sheet failed and nothing is dispatched. */
export function sheetsAnnouncement(verb: LoadPilesArgs['verb'], loaded: number, failed: readonly string[]): string {
  const sheets = `${verb} ${loaded} of ${plural(loaded + failed.length, 'sheet')}.`;
  return failed.length > 0 ? `${sheets} Failed: ${failed.join(', ')}.` : sheets;
}

export interface LoadPilesResult extends ActionResult {
  /** Each pile's merge and shortfalls, in the same order as `loads`. */
  results: LoadPileResult[];
}

/**
 * CD-12: loads several piles at once, from their sheets, as one action, so a
 * session start or Reload all is one undo step. Each pile follows loadPile
 * (SP-3, CD-5). The announcement counts the sheets and names the failures.
 */
export function loadPiles(state: SessionState, args: LoadPilesArgs, context: ActionContext): LoadPilesResult {
  let next = state;
  const results: LoadPileResult[] = [];
  for (const load of args.loads) {
    const result = loadPile(next, load, context);
    next = result.state;
    results.push(result);
  }
  const announcement = sheetsAnnouncement(args.verb, args.loads.length, args.failed);
  return { state: next, announcement, results };
}
