/** What pasted text turns out to be (CD-7, CD-8). */
export type SheetUrl =
  /** Fetchable. `fallbackName` names the set when the server sends no file name. */
  | { kind: 'ok'; url: string; fallbackName: string }
  /** Not a web address. */
  | { kind: 'invalid'; error: string }
  /** A Google Sheets link that isn't the published CSV: show the how-to (CD-8). */
  | { kind: 'edit-link'; error: string };

/** The steps shown for an edit or share link (CD-8). */
export const PUBLISH_STEPS = [
  'In the sheet, choose File → Share → Publish to web.',
  'Choose the tab, and choose Comma-separated values (.csv).',
  'Choose Publish.',
  'Copy the link and paste it here.',
];

function isGoogleSheet(url: URL): boolean {
  return url.hostname === 'docs.google.com' && url.pathname.startsWith('/spreadsheets');
}

/** The name for a set whose server sent no file name. */
function fallbackName(url: URL): string {
  if (url.hostname.endsWith('google.com')) return 'Google Sheet';
  const last = url.pathname.split('/').filter(Boolean).pop();
  if (last) {
    try {
      return decodeURIComponent(last);
    } catch {
      return last;
    }
  }
  return url.hostname;
}

/** Classifies pasted text as a fetchable CSV address, a Sheets edit link or neither. */
export function classifySheetUrl(text: string): SheetUrl {
  const trimmed = text.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { kind: 'invalid', error: trimmed ? "That isn't a web address. It should start with https://." : 'Enter the address of a CSV.' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { kind: 'invalid', error: 'The address must start with http:// or https://.' };
  }
  if (isGoogleSheet(url)) {
    const asksForCsv = url.searchParams.get('output') === 'csv' || url.searchParams.get('format') === 'csv';
    if (!asksForCsv) {
      return { kind: 'edit-link', error: "That's a link to the sheet itself, not to its published CSV, so it can't be loaded." };
    }
  }
  return { kind: 'ok', url: url.href, fallbackName: fallbackName(url) };
}
