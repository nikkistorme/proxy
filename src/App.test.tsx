import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { testContext } from './actions/testing';
import { GameScreen } from './components/GameScreen';
import { createGameStore, GameStoreProvider } from './store/gameStore';

function csvFile(text: string, name = 'deck.csv'): File {
  return new File([text], name, { type: 'text/csv' });
}

function renderGame() {
  const user = userEvent.setup();
  render(
    <GameStoreProvider store={createGameStore(undefined, testContext())}>
      <GameScreen />
    </GameStoreProvider>,
  );
  return user;
}

const mainTile = () => screen.getByRole('button', { name: /^P1 main deck,/ });

async function loadIntoMain(user: ReturnType<typeof userEvent.setup>, text: string, options: { keepOrder?: boolean } = {}) {
  await user.click(mainTile());
  if (options.keepOrder) await user.click(screen.getByRole('menuitemcheckbox', { name: 'Keep CSV order' }));
  await user.click(screen.getByRole('menuitem', { name: /^(Load CSV|Reload)/ }));
  await user.upload(screen.getByTestId('csv-file'), csvFile(text));
}

describe('App shell', () => {
  it('has the app heading, a seat bar, the table and the active hand', () => {
    renderGame();
    expect(screen.getByRole('banner')).toContainElement(screen.getByRole('heading', { level: 1, name: 'Proxy' }));
    const seats = screen.getByRole('region', { name: 'Seats' });
    expect(within(seats).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Player 1Active', 'Environment']);
    expect(within(screen.getByRole('main')).getByRole('list', { name: 'Piles' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: "Player 1's hand" })).toBeInTheDocument();
  });

  it('SP-5: shows every pile of the Solo preset, empty to start', () => {
    renderGame();
    const piles = within(screen.getByRole('list', { name: 'Piles' })).getAllByRole('button');
    expect(piles.map((b) => b.getAttribute('aria-label'))).toEqual([
      'P1 main deck, empty, 0 cards, Player 1',
      'Environment deck, empty, 0 cards, Environment',
      'Board cards, empty, 0 cards, shared',
    ]);
  });
});

describe('SP-1 load a deck into a pile', () => {
  it('loads from the pile menu, shows the results and updates the pile', async () => {
    const user = renderGame();
    await loadIntoMain(user, 'name,qty\nImp,2\n,1\nOgre,1\n');

    const dialog = screen.getByRole('dialog', { name: 'Import results' });
    expect(dialog).toHaveTextContent('deck.csv into P1 main deck');
    expect(dialog).toHaveTextContent('2 cards imported · 2 new · 0 updated');
    expect(within(dialog).getByRole('table', { name: '1 problem' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Loaded deck.csv into P1 main deck: 3 cards, shuffled.');

    await user.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(mainTile()).toHaveAccessibleName('P1 main deck, 3 cards, Player 1');
    expect(mainTile()).toHaveFocus();
  });

  it('SP-3: keeps CSV order when asked', async () => {
    const user = renderGame();
    await loadIntoMain(user, 'name\nImp\nOgre\nTroll\n', { keepOrder: true });
    await user.click(screen.getByRole('button', { name: 'Done' }));
    await user.click(screen.getByRole('button', { name: 'Draw' }));
    expect(screen.getByRole('status')).toHaveTextContent('Player 1 drew Imp from P1 main deck. 2 cards left.');
  });

  it('SP-2: offers Reload with the last file name, and reports copies it could not remove', async () => {
    const user = renderGame();
    await loadIntoMain(user, 'name,qty\nImp,2\n', { keepOrder: true });
    await user.click(screen.getByRole('button', { name: 'Done' }));
    await user.click(screen.getByRole('button', { name: 'Draw' }));
    await user.click(screen.getByRole('button', { name: 'Draw' }));

    await user.click(mainTile());
    expect(screen.getByRole('menuitem', { name: 'Reload deck.csv…' })).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Reload deck.csv…' }));
    await user.upload(screen.getByTestId('csv-file'), csvFile('name,qty\nImp,1\n'));
    expect(screen.getByRole('dialog')).toHaveTextContent('More copies in play than the new qty, so these stay: Imp (1 extra copy)');
  });
});

describe('SP-6 draw', () => {
  it('draws from the hand tray, the D key and the pile menu', async () => {
    const user = renderGame();
    await loadIntoMain(user, 'name\nImp\nOgre\nTroll\n', { keepOrder: true });
    await user.click(screen.getByRole('button', { name: 'Done' }));

    await user.click(screen.getByRole('button', { name: 'Draw' }));
    await user.keyboard('d');
    await user.click(mainTile());
    await user.click(screen.getByRole('menuitem', { name: 'Draw 1' }));

    const hand = screen.getByRole('list', { name: "Player 1's hand, 3 cards" });
    expect(within(hand).getAllByRole('img').map((c) => c.getAttribute('aria-label'))).toEqual(['Imp', 'Ogre', 'Troll']);
    expect(mainTile()).toHaveAccessibleName('P1 main deck, empty, 0 cards, Player 1');
    expect(screen.getByRole('status')).toHaveTextContent('Player 1 drew Troll from P1 main deck. 0 cards left.');
  });

  it('ignores D while a menu is open or with a modifier key', async () => {
    const user = renderGame();
    await loadIntoMain(user, 'name\nImp\n');
    await user.click(screen.getByRole('button', { name: 'Done' }));
    await user.keyboard('{Control>}d{/Control}');
    await user.click(mainTile());
    await user.keyboard('d');
    expect(screen.getByText('No cards in hand. Draw from Player 1\'s deck to start.')).toBeInTheDocument();
  });

  it('says so when the deck is empty', async () => {
    const user = renderGame();
    await user.keyboard('d');
    expect(screen.getByRole('status')).toHaveTextContent('P1 main deck is empty. No cards drawn.');
  });
});

describe('Pile menu focus', () => {
  it('returns focus to the pile when the menu closes with Escape', async () => {
    const user = renderGame();
    await user.click(mainTile());
    expect(screen.getByRole('menu', { name: 'Actions for P1 main deck' })).toBeInTheDocument();
    expect(mainTile()).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(mainTile()).toHaveFocus();
  });

  it('closes the menu when its pile is clicked again', async () => {
    const user = renderGame();
    await user.click(mainTile());
    await user.click(mainTile());
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
