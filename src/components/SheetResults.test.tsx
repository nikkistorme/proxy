import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { needsAttention, SheetResults, type SheetResultsData } from './SheetResults';

const ok = (pileName: string) => ({
  ok: true as const,
  pileName,
  summary: { fileName: 'Deck.csv', pileName, cardCount: 3, added: 2, updated: 1, missingNames: ['Gone'], problems: [], shortfalls: [{ name: 'Imp', extra: 1 }], fetchedAt: 0 },
});

describe('CD-12 sheet results', () => {
  const data: SheetResultsData = {
    kind: 'reload',
    items: [
      ok('P1 main deck'),
      { ok: false, pileName: 'P2 main deck', sourceName: 'Other.csv', error: 'The server answered 404.', keepsData: true },
      { ok: false, pileName: 'Board cards', sourceName: 'Google Sheet', error: 'You are offline.', keepsData: false },
    ],
  };

  it('lists each pile with counts, missing cards, shortfalls and the fetch note, or its error', () => {
    render(<SheetResults results={data} onClose={() => undefined} />);
    const dialog = screen.getByRole('dialog', { name: 'Sheet results' });
    expect(dialog).toHaveTextContent('Reloaded 1 of 3 sheets');
    expect(dialog).toHaveTextContent('3 cards imported · 2 new · 1 updated · 1 missing');
    expect(dialog).toHaveTextContent('No longer in the CSV, kept in the deck: Gone');
    expect(dialog).toHaveTextContent('Imp (1 extra copy)');
    expect(dialog).toHaveTextContent('Google can take a few minutes');
    expect(dialog).toHaveTextContent('Error: The server answered 404.');
    expect(dialog).toHaveTextContent('P2 main deck keeps its last good data.');
    expect(within(dialog).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['P1 main deck · Deck.csv', 'P2 main deck · Other.csv', 'Board cards · Google Sheet']);
    expect(dialog).not.toHaveTextContent('Board cards keeps');
  });

  it('lists a row problem by row and column', () => {
    const withProblem: SheetResultsData = { kind: 'start', items: [{ ok: true, pileName: 'Deck', summary: { fileName: 'D.csv', cardCount: 1, added: 1, updated: 0, missingNames: [], problems: [{ row: 4, column: 'qty', message: 'qty must be a number' }] } }] };
    render(<SheetResults results={withProblem} onClose={() => undefined} />);
    expect(screen.getByRole('table')).toHaveTextContent('4qtyqty must be a number');
  });

  it('opens at a start only when something failed or has row problems', () => {
    const clean: SheetResultsData = { kind: 'start', items: [ok('A')] };
    expect(needsAttention(clean)).toBe(false);
    expect(needsAttention(data)).toBe(true);
  });
});
