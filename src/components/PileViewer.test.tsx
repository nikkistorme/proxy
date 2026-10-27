import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { sessionWithDeck, namesOf, tableIds, testContext } from '../actions/testing';
import type { SessionState } from '../model/session';
import { createSessionStore, SessionStoreProvider } from '../store/sessionStore';
import { PileViewer } from './PileViewer';

const csv = `name,type,faction,rules
Ember Scout,Unit,Ember,Look at the top card of any pile.
Tide Caller,Unit,Tide,Draw a card.
Emberline Courier,Unit,Ember,Draw a card if a Location is in play.
Kindle Ward,Ward,Ember,Prevent the first 2 damage.
`;

/** "Ember Scout. Unit. … #1 from top" as "Ember Scout, #1 from top". */
const short = (label: string | null) => label?.replace(/^([^.]+)\..* (#\d+ from top)$/, '$1, $2');

/** A card button by its name and position. */
const card = (name: string, position: number) => new RegExp(`^${name}\\. .* #${position} from top$`);

function renderViewer(session: SessionState = sessionWithDeck(csv), pileId = 'pile-p1-main') {
  const user = userEvent.setup();
  const store = createSessionStore(session, testContext());
  const onClose = vi.fn();
  render(
    <SessionStoreProvider store={store}>
      <PileViewer pileId={pileId} onClose={onClose} />
    </SessionStoreProvider>,
  );
  const dialog = screen.getByRole('dialog', { name: 'P1 main deck' });
  const state = () => store.getState().session;
  const pileNames = () => namesOf(state(), state().piles[0]?.cardIds);
  const shown = () => within(dialog).queryAllByRole('button', { name: /from top$/ }).map((b) => short(b.getAttribute('aria-label')));
  return { user, dialog, onClose, store, state, pileNames, shown };
}

describe('SP-7 pile viewer', () => {
  it('shows every card face up in deck order, with its position, and focuses the search', () => {
    const { dialog, shown } = renderViewer();
    expect(dialog).toHaveTextContent('4 cards · shown face up to you only');
    expect(shown()).toEqual([
      'Ember Scout, #1 from top',
      'Tide Caller, #2 from top',
      'Emberline Courier, #3 from top',
      'Kindle Ward, #4 from top',
    ]);
    expect(screen.getByRole('button', { name: /^Ember Scout/ })).toHaveAccessibleName(
      'Ember Scout. Unit. Look at the top card of any pile. #1 from top',
    );
    expect(screen.getByRole('textbox', { name: 'Search name or text' })).toHaveFocus();
  });

  it('searches and filters, says how many match, and clears both', async () => {
    const { user, dialog, shown } = renderViewer();
    await user.type(screen.getByRole('textbox', { name: 'Search name or text' }), 'draw');
    expect(shown()).toEqual(['Tide Caller, #2 from top', 'Emberline Courier, #3 from top']);
    expect(within(dialog).getByText(/match/)).toHaveTextContent('2 of 4 match “draw”');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Faction' }), 'Ember');
    expect(shown()).toEqual(['Emberline Courier, #3 from top']);
    expect(within(dialog).getByText(/match/)).toHaveTextContent('1 of 4 match “draw” · Faction: Ember');

    await user.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(shown()).toHaveLength(4);
    expect(screen.getByRole('combobox', { name: 'Faction' })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'Search name or text' })).toHaveFocus();
  });

  it('says when nothing matches, and when the pile is empty', async () => {
    const { user, dialog } = renderViewer();
    await user.type(screen.getByRole('textbox', { name: 'Search name or text' }), 'zzz');
    expect(dialog).toHaveTextContent('No cards match.');
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(dialog).not.toHaveTextContent('No cards match.');
  });

  it('closes with the close button', async () => {
    const { user, onClose } = renderViewer();
    await user.click(screen.getByRole('button', { name: 'Close pile viewer (Esc)' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('SP-8 move a card from the pile viewer', () => {
  it('moves a card to the table, keeps the rest in order, and focuses the next match', async () => {
    const { user, dialog, state, pileNames } = renderViewer();
    await user.click(screen.getByRole('button', { name: card('Tide Caller', 2) }));
    await user.click(screen.getByRole('button', { name: 'To table: Tide Caller' }));

    expect(namesOf(state(), tableIds(state()))).toEqual(['Tide Caller']);
    expect(state().cards[tableIds(state())[0] ?? '']?.side).toBe('front');
    expect(pileNames()).toEqual(['Ember Scout', 'Emberline Courier', 'Kindle Ward']);
    expect(screen.getByRole('button', { name: card('Emberline Courier', 2) })).toHaveFocus();
    expect(within(dialog).getByText('Moved Tide Caller from P1 main deck to the table.')).toBeInTheDocument();
  });

  it('keyboard: arrows browse, Enter sends to hand, T to the table, then focus returns to the search', async () => {
    const { user, state, pileNames } = renderViewer();
    await user.type(screen.getByRole('textbox', { name: 'Search name or text' }), 'ember');
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', { name: card('Ember Scout', 1) })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: card('Emberline Courier', 3) })).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('button', { name: card('Kindle Ward', 4) })).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(namesOf(state(), state().hands['seat-p1'])).toEqual(['Kindle Ward']);
    // The last match was moved, so the one before it takes focus.
    expect(screen.getByRole('button', { name: card('Emberline Courier', 3) })).toHaveFocus();

    await user.keyboard('t');
    expect(screen.getByRole('button', { name: card('Ember Scout', 1) })).toHaveFocus();
    await user.keyboard('t');
    expect(namesOf(state(), tableIds(state()))).toEqual(['Emberline Courier', 'Ember Scout']);
    expect(pileNames()).toEqual(['Tide Caller']);
    expect(screen.getByRole('textbox', { name: 'Search name or text' })).toHaveFocus();
  });

  it('only the chosen card holds the tab stop and shows its actions', async () => {
    const { user } = renderViewer();
    const first = screen.getByRole('button', { name: card('Ember Scout', 1) });
    const second = screen.getByRole('button', { name: card('Tide Caller', 2) });
    expect(first).toHaveAttribute('tabindex', '0');
    expect(second).toHaveAttribute('tabindex', '-1');
    expect(screen.getAllByRole('button', { name: /^To table/ })).toHaveLength(1);

    await user.click(second);
    expect(second).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('button', { name: 'To hand: Tide Caller' })).toBeInTheDocument();
  });

  it('says so when the active seat has no hand', async () => {
    const session = { ...sessionWithDeck(csv), activeSeatId: 'seat-env' };
    const { user, dialog, state } = renderViewer(session);
    await user.click(screen.getByRole('button', { name: 'To hand: Ember Scout' }));
    expect(within(dialog).getByText('Environment has no hand.')).toBeInTheDocument();
    expect(state().piles[0]?.cardIds).toHaveLength(4);
  });
});

describe('SP-8 Move to… from the pile viewer', () => {
  it('moves the current card to the bottom of another pile, then focuses the next match', async () => {
    const { user, state, pileNames } = renderViewer();
    await user.click(screen.getByRole('button', { name: card('Tide Caller', 2) }));
    await user.click(screen.getByRole('button', { name: 'Move to…: Tide Caller' }));
    const move = screen.getByRole('dialog', { name: 'Tide Caller' });
    expect(move).toHaveTextContent('Move card · from P1 main deck');
    await user.type(within(move).getByRole('combobox'), 'board{ArrowDown}{Enter}');

    expect(namesOf(state(), state().piles.find((p) => p.id === 'pile-board')?.cardIds)).toEqual(['Tide Caller']);
    expect(pileNames()).toEqual(['Ember Scout', 'Emberline Courier', 'Kindle Ward']);
    expect(screen.queryByRole('dialog', { name: 'Tide Caller' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: card('Emberline Courier', 2) })).toHaveFocus();
  });

  it('M opens it, and cancelling leaves the card, focus and the viewer where they were', async () => {
    const { user, pileNames, onClose } = renderViewer();
    await user.type(screen.getByRole('textbox', { name: 'Search name or text' }), 'kindle');
    await user.keyboard('{ArrowDown}m');
    expect(screen.getByRole('dialog', { name: 'Kindle Ward' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(pileNames()).toHaveLength(4);
    expect(screen.getByRole('button', { name: card('Kindle Ward', 4) })).toHaveFocus();
    // Regression: closing the Move dialog also closed the viewer.
    expect(onClose).not.toHaveBeenCalled();
  });

  it('can move a card to the top of its own pile', async () => {
    const { user, pileNames } = renderViewer();
    await user.click(screen.getByRole('button', { name: card('Kindle Ward', 4) }));
    await user.keyboard('m');
    await user.keyboard('main deck — top{Enter}');
    expect(pileNames()).toEqual(['Kindle Ward', 'Ember Scout', 'Tide Caller', 'Emberline Courier']);
  });
});

describe('SP-6 pile viewer footer', () => {
  it('reveals and draws the top card', async () => {
    const { user, state, shown } = renderViewer();
    await user.click(screen.getByRole('button', { name: 'Reveal top card' }));
    expect(state().cards[state().piles[0]?.cardIds[0] ?? '']?.side).toBe('front');
    await user.click(screen.getByRole('button', { name: 'Draw top card' }));
    expect(namesOf(state(), state().hands['seat-p1'])).toEqual(['Ember Scout']);
    expect(shown()).toHaveLength(3);
  });

  it('disables the footer actions on an empty pile', async () => {
    const { user, dialog, state } = renderViewer(sessionWithDeck('name\n'));
    expect(dialog).toHaveTextContent('This pile is empty.');
    for (const name of ['Shuffle', 'Draw top card', 'Reveal top card']) {
      const button = screen.getByRole('button', { name });
      expect(button).toHaveAttribute('aria-disabled', 'true');
      await user.click(button);
    }
    expect(state().hands['seat-p1']).toEqual([]);
  });
});
