import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ImportResults, type ImportSummary } from './ImportResults';

const summary: ImportSummary = {
  fileName: 'deck.csv',
  cardCount: 4,
  added: 3,
  updated: 1,
  missingNames: [],
  problems: [
    { row: 2, column: 'name', message: 'Missing name.' },
    { row: 7, message: 'Row has 5 values but the header has 4 columns. Extra values are ignored.' },
  ],
};

describe('CD-4 import results', () => {
  it('lists every problem with its row, column and what is wrong', () => {
    render(<ImportResults summary={summary} onClose={() => {}} />);
    const table = screen.getByRole('table', { name: '2 problems' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent))).toEqual([
      ['2', 'name', 'Missing name.'],
      ['7', '—', 'Row has 5 values but the header has 4 columns. Extra values are ignored.'],
    ]);
  });

  it('summarises what imported', () => {
    render(<ImportResults summary={summary} onClose={() => {}} />);
    expect(screen.getByRole('dialog', { name: 'Import results' })).toHaveTextContent('deck.csv');
    expect(screen.getByText('4 cards imported · 3 new · 1 updated')).toBeInTheDocument();
  });

  it('lists cards no longer in the CSV', () => {
    render(<ImportResults summary={{ ...summary, missingNames: ['Ogre', 'Troll'] }} onClose={() => {}} />);
    expect(screen.getByText('4 cards imported · 3 new · 1 updated · 2 missing')).toBeInTheDocument();
    expect(screen.getByText('No longer in the CSV, kept in the deck: Ogre, Troll')).toBeInTheDocument();
  });

  it('says so when there are no problems', () => {
    render(<ImportResults summary={{ ...summary, cardCount: 1, problems: [] }} onClose={() => {}} />);
    expect(screen.getByRole('heading', { name: 'No problems found' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText(/^1 card imported/)).toBeInTheDocument();
  });

  it('reports close from both the Done and the close buttons', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { rerender } = render(<ImportResults summary={summary} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(<ImportResults summary={undefined} onClose={onClose} />);
    rerender(<ImportResults summary={summary} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('renders nothing inside the dialog when there is no import', () => {
    render(<ImportResults summary={undefined} onClose={() => {}} />);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });
});
