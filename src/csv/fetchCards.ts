import type { ImportedCard } from '../model/card';
import { fetchCsv } from './fetchCsv';
import { importCards } from './importCards';
import type { ImportProblem } from './types';

export type FetchCardsResult =
  | { ok: true; cards: ImportedCard[]; problems: ImportProblem[]; fileName: string }
  | { ok: false; error: string; aborted?: boolean };

/**
 * Fetches a CSV and reads its cards (CD-9). A fetch that yields no cards counts
 * as failed, with the first problem's message, so junk text can never reach a
 * pile and mark all its cards missing (CD-11).
 */
export async function fetchCards(url: string, fallbackName: string, signal?: AbortSignal): Promise<FetchCardsResult> {
  const fetched = await fetchCsv(url, fallbackName, signal);
  if (!fetched.ok) return fetched;
  const { cards, problems } = importCards(fetched.text);
  if (cards.length === 0) {
    return { ok: false, error: problems[0]?.message ?? 'That CSV has no cards.' };
  }
  return { ok: true, cards, problems, fileName: fetched.fileName };
}
