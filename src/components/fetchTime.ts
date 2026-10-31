/** Shown wherever a fetch time is (CD-9). */
export const GOOGLE_NOTE = 'Google can take a few minutes to update published data after an edit.';

/** A fetch time for people, like "31 Oct 2026, 14:05". */
export function formatFetchTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
