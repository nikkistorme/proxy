import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCards } from './fetchCards';

afterEach(() => vi.unstubAllGlobals());

function serve(body: string) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { headers: { 'content-type': 'text/csv' } })));
}

describe('CD-11 a fetch with no cards fails', () => {
  it('returns the cards and problems of a good CSV', async () => {
    serve('name,qty\nImp,2\n,1\n');
    const result = await fetchCards('https://example.com/a.csv', 'a.csv');
    expect(result).toMatchObject({ ok: true, fileName: 'a.csv' });
    expect(result.ok && result.cards).toHaveLength(1);
    expect(result.ok && result.problems).toHaveLength(1);
  });

  it("fails with the first problem's message when nothing imports", async () => {
    serve('title,cost\nImp,2\n');
    expect(await fetchCards('https://example.com/a.csv', 'a.csv')).toEqual({ ok: false, error: 'Missing name.' });
  });
});
