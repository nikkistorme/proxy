import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { draw } from '../actions/pileActions';
import { sessionWithDeck, testContext } from '../actions/testing';
import { createSessionStore, SessionStoreProvider } from '../store/sessionStore';
import { TableTools } from './TableTools';

function setup() {
  const store = createSessionStore(sessionWithDeck(), testContext());
  render(
    <SessionStoreProvider store={store}>
      <TableTools />
      <input aria-label="Field" />
    </SessionStoreProvider>,
  );
  const drawOne = () => act(() => void store.getState().dispatch((g) => draw(g, { pileId: 'pile-p1-main' })));
  const handSize = () => store.getState().session.hands['seat-p1']?.length;
  return { store, drawOne, handSize };
}

describe('TT-15 undo and redo controls', () => {
  it('names the buttons and marks them unavailable with nothing to undo or redo', async () => {
    const { store, drawOne } = setup();
    expect(screen.getByRole('navigation', { name: 'Table tools' })).toBeInTheDocument();
    const undo = screen.getByRole('button', { name: 'Undo (Ctrl+Z), nothing to undo' });
    expect(undo).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Redo (Ctrl+Shift+Z), nothing to redo' })).toHaveAttribute('aria-disabled', 'true');

    await userEvent.click(undo);
    expect(store.getState().announcement.text).toBe('Nothing to undo.');

    drawOne();
    expect(screen.getByRole('button', { name: 'Undo (Ctrl+Z)' })).not.toHaveAttribute('aria-disabled');
  });

  it('undoes and redoes from the buttons, keeping focus on the pressed button', async () => {
    const { drawOne, handSize } = setup();
    drawOne();
    const undo = screen.getByRole('button', { name: 'Undo (Ctrl+Z)' });
    await userEvent.click(undo);
    expect(handSize()).toBe(0);
    expect(undo).toHaveFocus();
    expect(undo).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Redo (Ctrl+Shift+Z)' }));
    expect(handSize()).toBe(1);
  });

  it('undoes with Ctrl or ⌘+Z and redoes with Ctrl or ⌘+Shift+Z and Ctrl+Y', async () => {
    const { drawOne, handSize } = setup();
    drawOne();
    await userEvent.keyboard('{Control>}z{/Control}');
    expect(handSize()).toBe(0);
    await userEvent.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
    expect(handSize()).toBe(1);
    await userEvent.keyboard('{Meta>}z{/Meta}');
    expect(handSize()).toBe(0);
    await userEvent.keyboard('{Meta>}{Shift>}z{/Shift}{/Meta}');
    expect(handSize()).toBe(1);
    await userEvent.keyboard('{Control>}z{/Control}{Control>}y{/Control}');
    expect(handSize()).toBe(1);
  });

  it('leaves the keys alone in a field, under an open dialog or menu, and without a modifier', async () => {
    const { drawOne, handSize } = setup();
    drawOne();
    await userEvent.click(screen.getByRole('textbox', { name: 'Field' }));
    await userEvent.keyboard('{Control>}z{/Control}');
    expect(handSize()).toBe(1);

    screen.getByRole('textbox', { name: 'Field' }).blur();
    const menu = document.body.appendChild(document.createElement('div'));
    menu.setAttribute('role', 'menu');
    await userEvent.keyboard('{Control>}z{/Control}');
    expect(handSize()).toBe(1);
    menu.remove();

    const dialog = document.body.appendChild(document.createElement('dialog'));
    dialog.setAttribute('open', '');
    await userEvent.keyboard('{Control>}z{/Control}');
    expect(handSize()).toBe(1);
    dialog.remove();

    await userEvent.keyboard('z');
    expect(handSize()).toBe(1);
    await userEvent.keyboard('{Control>}z{/Control}');
    expect(handSize()).toBe(0);
  });
});

describe('TT-1 and TT-2 zoom, fit and snap controls', () => {
  function setupView() {
    const store = createSessionStore(sessionWithDeck(), testContext());
    const calls: string[] = [];
    store.getState().setTableViewport({
      stepZoom: (direction) => calls.push(`zoom ${direction}`),
      resetZoom: () => calls.push('reset'),
      fitAll: () => calls.push('fit'),
    });
    render(
      <SessionStoreProvider store={store}>
        <TableTools />
        <input aria-label="Field" />
      </SessionStoreProvider>,
    );
    return { store, calls };
  }

  it('zooms, resets and fits from the buttons, and shows the zoom level', async () => {
    const { store, calls } = setupView();
    await userEvent.click(screen.getByRole('button', { name: 'Zoom in (+)' }));
    await userEvent.click(screen.getByRole('button', { name: 'Zoom out (−)' }));
    await userEvent.click(screen.getByRole('button', { name: 'Zoom 100%, reset' }));
    await userEvent.click(screen.getByRole('button', { name: 'Fit all cards (0)' }));
    expect(calls).toEqual(['zoom in', 'zoom out', 'reset', 'fit']);
    act(() => store.getState().setView({ zoom: 1.25 }));
    expect(screen.getByRole('button', { name: 'Zoom 125%, reset' })).toHaveTextContent('125%');
  });

  it('toggles grid snapping, off by default, and announces it', async () => {
    const { store } = setupView();
    const snap = screen.getByRole('button', { name: 'Snap to grid (G)' });
    expect(snap).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(snap);
    expect(snap).toHaveAttribute('aria-pressed', 'true');
    expect(store.getState().view.snap).toBe(true);
    expect(store.getState().announcement.text).toBe('Snap to grid on.');
    expect(store.getState().past).toEqual([]);
  });

  it('zooms with + = and −, fits with 0, and snaps with G, but not in a field or with Ctrl', async () => {
    const { store, calls } = setupView();
    screen.getByRole('button', { name: 'Zoom in (+)' }).focus();
    await userEvent.keyboard('+=-0g');
    expect(calls).toEqual(['zoom in', 'zoom in', 'zoom out', 'fit']);
    expect(store.getState().view.snap).toBe(true);

    await userEvent.keyboard('{Control>}={/Control}{Meta>}-{/Meta}');
    await userEvent.click(screen.getByRole('textbox', { name: 'Field' }));
    await userEvent.keyboard('+0g');
    expect(calls).toHaveLength(4);
    expect(store.getState().view.snap).toBe(true);
  });
});
