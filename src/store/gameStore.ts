import { createContext, createElement, useContext, useState, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { createSoloGame, type ActionContext, type ActionResult, type GameState } from '../model/game';
import { cryptoRandomInt } from '../model/random';

export interface Announcement {
  text: string;
  /** Increments on every announcement, so repeating the same text is still read out. */
  id: number;
}

export interface GameStore {
  game: GameState;
  announcement: Announcement;
  /**
   * Runs a named action (AR-1) against the current game, stores the result and
   * announces it (AR-2). Returns the full result, for actions with extra output.
   */
  dispatch: <R extends ActionResult>(action: (game: GameState, context: ActionContext) => R) => R;
}

export const liveContext: ActionContext = { randomInt: cryptoRandomInt, newId: () => crypto.randomUUID() };

export function createGameStore(game: GameState = createSoloGame(), context: ActionContext = liveContext): StoreApi<GameStore> {
  return createStore<GameStore>()((set, get) => ({
    game,
    announcement: { text: '', id: 0 },
    dispatch: (action) => {
      const result = action(get().game, context);
      set({ game: result.state, announcement: { text: result.announcement, id: get().announcement.id + 1 } });
      return result;
    },
  }));
}

const GameStoreContext = createContext<StoreApi<GameStore> | null>(null);

export function GameStoreProvider({ store, children }: { store?: StoreApi<GameStore>; children: ReactNode }) {
  const [value] = useState(() => store ?? createGameStore());
  return createElement(GameStoreContext.Provider, { value }, children);
}

export function useGameStore<T>(selector: (store: GameStore) => T): T {
  const store = useContext(GameStoreContext);
  if (!store) throw new Error('useGameStore needs a GameStoreProvider');
  return useStore(store, selector);
}
