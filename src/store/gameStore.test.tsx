import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { draw } from '../actions/pileActions';
import { gameWithDeck, testContext } from '../actions/testing';
import { LiveRegion } from '../components/LiveRegion';
import { createGameStore, GameStoreProvider, useGameStore } from './gameStore';

describe('AR-2 store and live region', () => {
  it('dispatch runs an action, stores the new game and announces it', () => {
    const store = createGameStore(gameWithDeck(), testContext());
    const result = store.getState().dispatch((g) => draw(g, { pileId: 'pile-p1-main' }));
    expect(store.getState().game).toBe(result.state);
    expect(store.getState().announcement).toEqual({ text: 'Player 1 drew Imp from P1 main deck. 2 cards left.', id: 1 });
  });

  it('reads each announcement in a polite status region, even when the text repeats', () => {
    const store = createGameStore(gameWithDeck(), testContext());
    render(
      <GameStoreProvider store={store}>
        <LiveRegion />
      </GameStoreProvider>,
    );
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    act(() => {
      store.getState().dispatch((g) => draw(g, { pileId: 'pile-board' }));
    });
    const first = status.firstElementChild;
    expect(status).toHaveTextContent('Board cards is empty. No cards drawn.');
    act(() => {
      store.getState().dispatch((g) => draw(g, { pileId: 'pile-board' }));
    });
    expect(status).toHaveTextContent('Board cards is empty. No cards drawn.');
    expect(status.firstElementChild).not.toBe(first);
  });

  it('announces text that is not a game change', () => {
    const store = createGameStore(gameWithDeck(), testContext());
    const before = store.getState().game;
    store.getState().announce('Player 1 has no pile to draw from.');
    expect(store.getState().announcement).toEqual({ text: 'Player 1 has no pile to draw from.', id: 1 });
    expect(store.getState().game).toBe(before);
  });

  it('needs a provider', () => {
    function Reader() {
      useGameStore((s) => s.game);
      return null;
    }
    expect(() => render(<Reader />)).toThrow('useGameStore needs a GameStoreProvider');
  });

  it('creates a live store with a Solo game when none is given', () => {
    const store = createGameStore();
    expect(store.getState().game.seats.map((s) => s.name)).toEqual(['Player 1', 'Environment']);
  });
});
