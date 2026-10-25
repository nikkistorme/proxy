import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App';

function csvFile(text: string, name = 'deck.csv'): File {
  return new File([text], name, { type: 'text/csv' });
}

describe('App shell', () => {
  it('renders a main landmark with the app heading', () => {
    render(<App />);
    const main = screen.getByRole('main');
    expect(main).toContainElement(screen.getByRole('heading', { level: 1, name: 'Proxy' }));
  });
});

describe('Interim import panel', () => {
  it('CD-4: imports a CSV, shows the results, and lists the cards', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.upload(screen.getByTestId('csv-file'), csvFile('name,qty\nImp,1\n,1\nOgre,x\n'));

    const dialog = screen.getByRole('dialog', { name: 'Import results' });
    expect(dialog).toHaveTextContent('2 cards imported · 2 new · 0 updated');
    expect(within(dialog).getByRole('table', { name: '2 problems' })).toBeInTheDocument();

    const deck = screen.getByRole('region', { name: 'Deck (2 cards)' });
    expect(within(deck).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['ImpImp', 'OgreOgre']);
  });

  it('CD-5: importing again updates the same deck and reports missing cards', async () => {
    const user = userEvent.setup();
    render(<App />);
    const input = screen.getByTestId('csv-file');
    await user.upload(input, csvFile('name\nImp\nOgre\n'));
    await user.click(screen.getByRole('button', { name: 'Done' }));

    await user.upload(input, csvFile('name\nImp\nTroll\n'));
    const dialog = screen.getByRole('dialog', { name: 'Import results' });
    expect(dialog).toHaveTextContent('2 cards imported · 1 new · 1 updated · 1 missing');
    expect(dialog).toHaveTextContent('No longer in the CSV, kept in the deck: Ogre');
    expect(screen.getByText('· missing from CSV')).toBeInTheDocument();
  });

  it('returns focus to the Choose CSV file button when the results close', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.upload(screen.getByTestId('csv-file'), csvFile('name\nImp\n'));
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose CSV file' })).toHaveFocus();
  });
});
