export const FETCH_TIMEOUT_MS = 15_000;

export type FetchCsvResult = { ok: true; text: string; fileName: string } | { ok: false; error: string; aborted?: boolean };

/** The file name in a Content-Disposition header, preferring `filename*` (UTF-8). */
export function fileNameFromDisposition(header: string | null): string | undefined {
  if (!header) return undefined;
  const star = /filename\*\s*=\s*(?:UTF-8|utf-8)'[^']*'([^;]+)/i.exec(header);
  if (star?.[1]) {
    try {
      const name = decodeURIComponent(star[1].trim());
      if (name) return name;
    } catch {
      // Fall through to the plain name.
    }
  }
  const plain = /filename\s*=\s*(?:"([^"]*)"|([^;]+))/i.exec(header);
  const name = (plain?.[1] ?? plain?.[2])?.trim();
  return name || undefined;
}

function looksLikeHtml(contentType: string, body: string): boolean {
  return /text\/html/i.test(contentType) || /^\s*<(!doctype|html)/i.test(body);
}

/**
 * Fetches a CSV (CD-9, CD-11). `cache: 'no-store'` because Google marks
 * responses cacheable for five minutes, which would make Reload show old data.
 * Never throws: failures come back as a readable `error`.
 */
export async function fetchCsv(url: string, fallbackName: string, signal?: AbortSignal): Promise<FetchCsvResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: false, error: "You're offline, so the sheet couldn't be fetched." };
  }
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, FETCH_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const response = await fetch(url, { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', signal: controller.signal });
    if (!response.ok) {
      const hint = [401, 403, 404].includes(response.status) ? ' The sheet may not be published or public.' : '';
      return { ok: false, error: `The server answered ${response.status}${response.statusText ? ` ${response.statusText}` : ''}.${hint}` };
    }
    const text = await response.text();
    if (looksLikeHtml(response.headers.get('content-type') ?? '', text)) {
      return { ok: false, error: "That address returned a web page, not a CSV. For a Google Sheet, publish the tab as CSV." };
    }
    if (text.trim() === '') return { ok: false, error: 'That address returned nothing.' };
    return { ok: true, text, fileName: fileNameFromDisposition(response.headers.get('content-disposition')) ?? fallbackName };
  } catch {
    if (timedOut) return { ok: false, error: `The server took longer than ${FETCH_TIMEOUT_MS / 1000} seconds to answer.` };
    if (signal?.aborted) return { ok: false, error: 'Cancelled.', aborted: true };
    return {
      ok: false,
      error: "Couldn't reach that address. The sheet may not be published, or the site may block loading from other pages.",
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
