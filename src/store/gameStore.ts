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

/** One undo step: the game before (or, for redo, after) an action, and what that action said. */
export interface HistoryEntry {
  game: GameState;
  announcement: string;
}

/** TT-15 asks for at least 200 undo steps. */
export const HISTORY_LIMIT = 200;

export interface GameStore {
  game: GameState;
  announcement: Announcement;
  /** Games before each action, oldest first. Actions never mutate, so these share unchanged parts. */
  past: HistoryEntry[];
  /** Games undone, most recently undone last. Cleared by any new action. */
  future: HistoryEntry[];
  /**
   * Runs a named action (AR-1) against the current game, stores the result and
   * announces it (AR-2). Returns the full result, for actions with extra output.
   * An action that changes nothing adds no undo step.
   */
  dispatch: <R extends ActionResult>(action: (game: GameState, context: ActionContext) => R) => R;
  /** Announces something that isn't a game change, like why nothing happened. */
  announce: (text: string) => void;
  /** TT-15: goes back one action, or announces that there is nothing to undo. */
  undo: () => void;
  /** TT-15: replays the last undone action, or announces that there is nothing to redo. */
  redo: () => void;
}

export const liveContext: ActionContext = { randomInt: cryptoRandomInt, newId: () => crypto.randomUUID() };

export function createGameStore(game: GameState = createSoloGame(), context: ActionContext = liveContext): StoreApi<GameStore> {
  return createStore<GameStore>()((set, get) => {
    const next = (text: string): Announcement => ({ text, id: get().announcement.id + 1 });
    return {
      game,
      announcement: { text: '', id: 0 },
      past: [],
      future: [],
      dispatch: (action) => {
        const { game: before, past } = get();
        const result = action(before, context);
        if (result.state === before) {
          set({ announcement: next(result.announcement) });
          return result;
        }
        set({
          game: result.state,
          announcement: next(result.announcement),
          past: [...past, { game: before, announcement: result.announcement }].slice(-HISTORY_LIMIT),
          future: [],
        });
        return result;
      },
      announce: (text) => set({ announcement: next(text) }),
      undo: () => {
        const { game: current, past, future } = get();
        const step = past.at(-1);
        if (!step) {
          set({ announcement: next('Nothing to undo.') });
          return;
        }
        set({
          game: step.game,
          announcement: next(`Undone: ${step.announcement}`),
          past: past.slice(0, -1),
          future: [...future, { game: current, announcement: step.announcement }],
        });
      },
      redo: () => {
        const { game: current, past, future } = get();
        const step = future.at(-1);
        if (!step) {
          set({ announcement: next('Nothing to redo.') });
          return;
        }
        set({
          game: step.game,
          announcement: next(`Redone: ${step.announcement}`),
          past: [...past, { game: current, announcement: step.announcement }],
          future: future.slice(0, -1),
        });
      },
    };
  });
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
