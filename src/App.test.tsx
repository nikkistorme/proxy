import { fireEvent, render, screen, within } from '@testing-library/react';
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
  it('does not take focus back when a dialog close event arrives after focus has moved on', async () => {
    const user = renderGame();
    await loadIntoMain(user, 'name\nImp\n');
    const dialog = screen.getByRole('dialog', { name: 'Import results' }) as HTMLDialogElement;
    // The player has already moved on before the (late) close event fires.
    const draw = screen.getByRole('button', { name: 'Draw' });
    draw.focus();
    dialog.open = false;
    fireEvent(dialog, new Event('close'));
    expect(draw).toHaveFocus();
  });

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

describe('SP-6 pile menu actions', () => {
  async function loaded(csv = 'name\nImp\nOgre\nTroll\nWisp\n') {
    const user = renderGame();
    await loadIntoMain(user, csv, { keepOrder: true });
    await user.click(screen.getByRole('button', { name: 'Done' }));
    return user;
  }

  async function choose(user: ReturnType<typeof userEvent.setup>, item: string) {
    await user.click(mainTile());
    await user.click(screen.getByRole('menuitem', { name: item }));
  }

  it('shuffles the pile', async () => {
    const user = await loaded();
    await choose(user, 'Shuffle');
    expect(screen.getByRole('status')).toHaveTextContent('Shuffled P1 main deck. 4 cards.');
  });

  it('reveals the top card on the pile', async () => {
    const user = await loaded();
    await choose(user, 'Reveal top card');
    expect(mainTile()).toHaveAccessibleName('P1 main deck, 4 cards, Player 1, top card face up: Imp');
    expect(screen.getByRole('status')).toHaveTextContent('Top of P1 main deck: Imp.');
  });

  it('draws N into the hand, then returns focus to the pile', async () => {
    const user = await loaded();
    await choose(user, 'Draw cards…');
    const field = screen.getByRole('spinbutton', { name: "Cards to draw into Player 1's hand" });
    await user.clear(field);
    await user.type(field, '3{Enter}');
    expect(screen.getByRole('list', { name: "Player 1's hand, 3 cards" })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Player 1 drew Imp, Ogre and Troll from P1 main deck. 1 card left.');
    expect(mainTile()).toHaveFocus();
  });

  it('mills N onto another pile', async () => {
    const user = await loaded();
    await choose(user, 'Mill cards…');
    const field = screen.getByRole('spinbutton', { name: 'Cards to move' });
    await user.clear(field);
    await user.type(field, '2');
    await user.click(screen.getByRole('radio', { name: /^Environment deck/ }));
    await user.click(screen.getByRole('button', { name: 'Move' }));
    expect(screen.getByRole('button', { name: /^Environment deck,/ })).toHaveAccessibleName('Environment deck, 2 cards, Environment');
    expect(screen.getByRole('status')).toHaveTextContent('Moved Imp and Ogre from P1 main deck to Environment deck.');
  });

  it('leaves Draw, Shuffle, Reveal and Mill unavailable on an empty pile', async () => {
    const user = renderGame();
    await user.click(mainTile());
    for (const name of ['Draw 1', 'Draw cards…', 'Shuffle', 'Reveal top card', 'Mill cards…']) {
      expect(screen.getByRole('menuitem', { name })).toHaveAttribute('aria-disabled', 'true');
    }
    await user.click(screen.getByRole('menuitem', { name: 'Draw cards…' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });
});

describe('SP-1 drop a file on a pile', () => {
  const drop = (target: Element, file: File) => {
    const dataTransfer = { types: ['Files'], files: [file] };
    fireEvent.dragEnter(target, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });
  };

  it('loads a dropped CSV into that pile', async () => {
    renderGame();
    drop(screen.getByRole('button', { name: /^Board cards,/ }), csvFile('name\nToken\nToken 2\n', 'tokens.csv'));
    expect(await screen.findByRole('dialog', { name: 'Import results' })).toHaveTextContent('tokens.csv into Board cards');
    expect(screen.getByRole('button', { name: /^Board cards,/ })).toHaveAccessibleName('Board cards, 2 cards, shared');
  });

  it('refuses a file that is not a CSV, and loads nothing', async () => {
    renderGame();
    drop(mainTile(), new File(['not a deck'], 'art.png', { type: 'image/png' }));
    const dialog = await screen.findByRole('dialog', { name: 'Import results' });
    expect(dialog).toHaveTextContent("art.png isn't a CSV file. Nothing was loaded.");
    expect(mainTile()).toHaveAccessibleName('P1 main deck, empty, 0 cards, Player 1');
  });

  it('stops the browser opening a file dropped anywhere else', () => {
    renderGame();
    const event = new Event('dragover', { cancelable: true });
    Object.defineProperty(event, 'dataTransfer', { value: { types: ['Files'] } });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});

describe('SP-4 manage piles', () => {
  const pileNames = () =>
    within(screen.getByRole('list', { name: 'Piles' }))
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label'));

  it('adds a pile and moves focus to it', async () => {
    const user = renderGame();
    await user.click(screen.getByRole('button', { name: 'Add pile' }));
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Discard{Enter}');
    expect(pileNames()).toContain('Discard, empty, 0 cards, Player 1');
    expect(screen.getByRole('button', { name: /^Discard,/ })).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('Added pile Discard (Player 1).');
  });

  it('returns focus to Add pile when adding is cancelled', async () => {
    const user = renderGame();
    await user.click(screen.getByRole('button', { name: 'Add pile' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Add pile' })).toHaveFocus();
  });

  it('renames a pile from its menu and keeps focus on it', async () => {
    const user = renderGame();
    await user.click(screen.getByRole('button', { name: /^Board cards,/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Rename…' }));
    await user.keyboard('Tokens{Enter}');
    expect(screen.getByRole('button', { name: /^Tokens,/ })).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('Renamed Board cards to Tokens.');
  });

  it('deletes an empty pile and moves focus to the next one', async () => {
    const user = renderGame();
    await user.click(screen.getByRole('button', { name: /^Environment deck,/ }));
    // Empty, so it goes without asking, and the toast offers Undo.
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(pileNames()).toEqual(['P1 main deck, empty, 0 cards, Player 1', 'Board cards, empty, 0 cards, shared']);
    expect(screen.getByRole('button', { name: /^Board cards,/ })).toHaveFocus();
    expect(document.querySelector('.toast')).toHaveTextContent('Deleted Environment deck.');
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(pileNames()).toHaveLength(3);
    expect(document.querySelector('.toast')).toBeNull();
  });

  it('deletes a pile with cards, moving them to the chosen pile', async () => {
    const user = renderGame();
    await loadIntoMain(user, 'name\nImp\nOgre\n');
    await user.click(screen.getByRole('button', { name: 'Done' }));
    await user.click(mainTile());
    await user.click(screen.getByRole('menuitem', { name: 'Delete…' }));
    await user.click(screen.getByRole('radio', { name: /^Board cards/ }));
    await user.click(screen.getByRole('button', { name: 'Delete pile' }));
    expect(screen.getByRole('button', { name: /^Board cards,/ })).toHaveAccessibleName('Board cards, 2 cards, shared');
    expect(screen.getByRole('status')).toHaveTextContent('Deleted P1 main deck. Moved 2 cards to the bottom of Board cards.');
  });

  it('keeps focus on the pile when a delete is cancelled', async () => {
    const user = renderGame();
    await loadIntoMain(user, 'name\nImp\n');
    await user.click(screen.getByRole('button', { name: 'Done' }));
    await user.click(mainTile());
    await user.click(screen.getByRole('menuitem', { name: 'Delete…' }));
    // jsdom doesn't close a dialog on Esc from a radio button; E2E covers Esc in real browsers.
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mainTile()).toHaveFocus();
  });

  it('moves focus to Add pile after deleting the last pile, and says when there is nothing to draw from', async () => {
    const user = renderGame();
    for (const name of [/^P1 main deck,/, /^Environment deck,/, /^Board cards,/]) {
      await user.click(screen.getByRole('button', { name }));
      await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    }
    expect(within(screen.getByRole('list', { name: 'Piles' })).queryAllByRole('button')).toEqual([]);
    expect(screen.getByRole('button', { name: 'Add pile' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Draw' }));
    expect(screen.getByRole('status')).toHaveTextContent('Player 1 has no pile to draw from.');
  });

  it('cannot delete the only pile while it holds cards', async () => {
    const user = renderGame();
    await loadIntoMain(user, 'name\nImp\n');
    await user.click(screen.getByRole('button', { name: 'Done' }));
    for (const name of [/^Environment deck,/, /^Board cards,/]) {
      await user.click(screen.getByRole('button', { name }));
      await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    }
    await user.click(mainTile());
    expect(screen.getByRole('menuitem', { name: 'Delete…' })).toHaveAttribute('aria-disabled', 'true');
  });
});
