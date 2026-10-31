import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchCsv, fileNameFromDisposition, FETCH_TIMEOUT_MS } from './fetchCsv';

const URL_ = 'https://example.com/deck.csv';

function respond(body: string, init: { status?: number; headers?: Record<string, string> } = {}) {
  return new Response(body, { status: init.status ?? 200, headers: { 'content-type': 'text/csv; charset=utf-8', ...init.headers } });
}

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('CD-9 fetching', () => {
  it('asks for fresh data, without credentials or a referrer', async () => {
    fetchMock.mockResolvedValue(respond('name\nImp\n'));
    const result = await fetchCsv(URL_, 'deck.csv');
    expect(result).toEqual({ ok: true, text: 'name\nImp\n', fileName: 'deck.csv' });
    expect(fetchMock).toHaveBeenCalledWith(URL_, expect.objectContaining({ cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' }));
  });

  it('names the set from filename* over filename, percent-decoded', async () => {
    const disposition = `attachment; filename="MyCardGame-Maincards.csv"; filename*=UTF-8''My%20Card%20Game%20-%20Main%20cards.csv`;
    fetchMock.mockResolvedValue(respond('name\nImp\n', { headers: { 'content-disposition': disposition } }));
    expect(await fetchCsv(URL_, 'Google Sheet')).toMatchObject({ ok: true, fileName: 'My Card Game - Main cards.csv' });
  });

  it('falls back to filename, then to the given name', () => {
    expect(fileNameFromDisposition('attachment; filename="a.csv"')).toBe('a.csv');
    expect(fileNameFromDisposition('attachment; filename=b.csv')).toBe('b.csv');
    expect(fileNameFromDisposition("attachment; filename*=UTF-8''%E0%A4%A; filename=\"c.csv\"")).toBe('c.csv');
    expect(fileNameFromDisposition(null)).toBeUndefined();
  });

  it('stops after 15 seconds', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_url: string, init: RequestInit) => new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))));
    const pending = fetchCsv(URL_, 'x');
    await vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS);
    expect(await pending).toEqual({ ok: false, error: 'The server took longer than 15 seconds to answer.' });
  });

  it("stops when the caller's signal aborts, and says so", async () => {
    fetchMock.mockImplementation((_url: string, init: RequestInit) => new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))));
    const controller = new AbortController();
    const pending = fetchCsv(URL_, 'x', controller.signal);
    controller.abort();
    expect(await pending).toMatchObject({ ok: false, aborted: true });
  });
});

describe('CD-11 failures', () => {
  it('says when the browser is offline, without fetching', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const result = await fetchCsv(URL_, 'x');
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('offline') });
    expect(fetchMock).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("says it couldn't reach the address when fetch rejects", async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await fetchCsv(URL_, 'x')).toMatchObject({ ok: false, error: expect.stringContaining("Couldn't reach that address") });
  });

  it.each([401, 403, 404])('names status %i and says it may not be published', async (status) => {
    fetchMock.mockResolvedValue(respond('', { status }));
    expect(await fetchCsv(URL_, 'x')).toMatchObject({ ok: false, error: expect.stringContaining(`${status}`) });
    fetchMock.mockResolvedValue(respond('', { status }));
    expect(await fetchCsv(URL_, 'x')).toMatchObject({ ok: false, error: expect.stringContaining('may not be published') });
  });

  it('names another status without the published hint', async () => {
    fetchMock.mockResolvedValue(respond('', { status: 500 }));
    const result = await fetchCsv(URL_, 'x');
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('500') });
    expect(result).not.toMatchObject({ error: expect.stringContaining('published') });
  });

  it.each([
    ['an HTML content type', '<p>hi</p>', { 'content-type': 'text/html' }],
    ['a body that starts like a page', '<!DOCTYPE html><title>x</title>', {}],
    ['a body with an html tag', '  <html>', {}],
    ['an empty body', '  \n', {}],
  ])('refuses %s as not a CSV', async (_label, body, headers) => {
    fetchMock.mockResolvedValue(respond(body, { headers }));
    expect(await fetchCsv(URL_, 'x')).toMatchObject({ ok: false });
  });
});
