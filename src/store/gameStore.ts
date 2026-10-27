import { createContext, createElement, useContext, useState, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { Destination } from '../actions/moveCard';
import { createSoloGame, type ActionContext, type ActionResult, type GameState } from '../model/game';
import { cryptoRandomInt } from '../model/random';
import { PLACEMENT_COLUMNS } from '../model/tablePlacement';

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

/** How the table is shown. Not part of the game: changing it is never an undo step. */
export interface TableView {
  zoom: number;
  /** TT-2: grid snapping, off by default. */
  snap: boolean;
  /** Cards that fit across the visible table, set by the table as it resizes and zooms. */
  columns: number;
}

/**
 * The table's viewport, registered by the table while it's on screen, so the
 * toolbar and keys can zoom and fit (TT-1) around what's actually in view.
 */
export interface TableViewport {
  stepZoom: (direction: 'in' | 'out') => void;
  resetZoom: () => void;
  fitAll: () => void;
}

/** A11Y-1: a card or pile being placed on the table by keyboard or single pointer. */
export type Placing =
  | {
      cardId: string;
      /** Where focus goes if placing is cancelled, when the card isn't on the table. */
      returnFocus?: () => void;
    }
  | { pileId: string };

/** TT-4: a card or pile being dragged, and the drop target under the pointer, if any. */
export interface CardDrag {
  cardId?: string;
  pileId?: string;
  over?: Destination;
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
  view: TableView;
  setView: (view: Partial<TableView>) => void;
  tableViewport: TableViewport | undefined;
  setTableViewport: (viewport: TableViewport | undefined) => void;
  /** A11Y-1: the card being placed, shown by the table as an outline you move and then place. */
  placing: Placing | undefined;
  setPlacing: (placing: Placing | undefined) => void;
  /** TT-4: the card being dragged, so its origin and the drop target can show it. */
  drag: CardDrag | undefined;
  setDrag: (drag: CardDrag | undefined) => void;
  /**
   * A short note with an Undo button, shown after a destructive action instead
   * of asking first. It stays until the next action, undo or redo.
   */
  toast: Announcement | undefined;
  showToast: (text: string) => void;
  dismissToast: () => void;
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
      view: { zoom: 1, snap: false, columns: PLACEMENT_COLUMNS },
      setView: (view) => set({ view: { ...get().view, ...view } }),
      tableViewport: undefined,
      setTableViewport: (tableViewport) => set({ tableViewport }),
      placing: undefined,
      setPlacing: (placing) => set({ placing }),
      drag: undefined,
      setDrag: (drag) => set({ drag }),
      toast: undefined,
      showToast: (text) => set({ toast: { text, id: (get().toast?.id ?? 0) + 1 } }),
      dismissToast: () => set({ toast: undefined }),
      dispatch: (action) => {
        const { game: before, past } = get();
        const result = action(before, { ...context, placementColumns: get().view.columns });
        if (result.state === before) {
          set({ announcement: next(result.announcement) });
          return result;
        }
        set({
          toast: undefined,
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
          toast: undefined,
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
          toast: undefined,
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
  return useStore(useGameStoreApi(), selector);
}

/** The store itself, for handlers that read its latest state without re-rendering on every change. */
export function useGameStoreApi(): StoreApi<GameStore> {
  const store = useContext(GameStoreContext);
  if (!store) throw new Error('useGameStore needs a GameStoreProvider');
  return store;
}
