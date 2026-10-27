import { createContext, createElement, useContext, useState, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { roll, type Die, type Roll } from '../actions/dice';
import type { Destination } from '../actions/moveCard';
import { createSoloSession, type ActionContext, type ActionResult, type SessionState } from '../model/session';
import { cryptoRandomInt } from '../model/random';
import { PLACEMENT_COLUMNS } from '../model/tablePlacement';

export interface Announcement {
  text: string;
  /** Increments on every announcement, so repeating the same text is still read out. */
  id: number;
}

/** One undo step: the session before (or, for redo, after) an action, and what that action said. */
export interface HistoryEntry {
  session: SessionState;
  announcement: string;
}

/** One line in the session log. Only rolls for now; other actions join it later (TT-14). */
export interface LogEntry {
  id: number;
  text: string;
  /** When it happened, in ms since the epoch. */
  at: number;
}

/** The log keeps this many entries, newest last. */
export const LOG_LIMIT = 50;

/** How the table is shown. Not part of the session: changing it is never an undo step. */
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

export interface SessionStore {
  session: SessionState;
  announcement: Announcement;
  /** Sessions before each action, oldest first. Actions never mutate, so these share unchanged parts. */
  past: HistoryEntry[];
  /** Sessions undone, most recently undone last. Cleared by any new action. */
  future: HistoryEntry[];
  /**
   * Runs a named action (AR-1) against the current session, stores the result and
   * announces it (AR-2). Returns the full result, for actions with extra output.
   * An action that changes nothing adds no undo step.
   */
  dispatch: <R extends ActionResult>(action: (session: SessionState, context: ActionContext) => R) => R;
  /** Announces something that isn't a session change, like why nothing happened. */
  announce: (text: string) => void;
  /** TT-15: goes back one action, or announces that there is nothing to undo. */
  undo: () => void;
  /** TT-15: replays the last undone action, or announces that there is nothing to redo. */
  redo: () => void;
  /** TT-14: the session log, oldest first. Not part of the session, so undo leaves it alone. */
  log: LogEntry[];
  /** The latest roll, shown large in Dice & coins. */
  lastRoll: (Roll & { id: number }) | undefined;
  /** TT-14: rolls a die or flips a coin, logs and announces it. Never an undo step. */
  roll: (die: Die) => Roll;
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

export function createSessionStore(session: SessionState = createSoloSession(), context: ActionContext = liveContext): StoreApi<SessionStore> {
  return createStore<SessionStore>()((set, get) => {
    const next = (text: string): Announcement => ({ text, id: get().announcement.id + 1 });
    return {
      session,
      announcement: { text: '', id: 0 },
      past: [],
      future: [],
      log: [],
      lastRoll: undefined,
      roll: (die) => {
        const result = roll(die, context.randomInt);
        const { log } = get();
        const id = (log.at(-1)?.id ?? 0) + 1;
        set({
          announcement: next(result.announcement),
          lastRoll: { ...result, id },
          log: [...log, { id, text: result.announcement.slice(0, -1), at: Date.now() }].slice(-LOG_LIMIT),
        });
        return result;
      },
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
        const { session: before, past } = get();
        const result = action(before, { ...context, placementColumns: get().view.columns });
        if (result.state === before) {
          set({ announcement: next(result.announcement) });
          return result;
        }
        set({
          toast: undefined,
          session: result.state,
          announcement: next(result.announcement),
          past: [...past, { session: before, announcement: result.announcement }].slice(-HISTORY_LIMIT),
          future: [],
        });
        return result;
      },
      announce: (text) => set({ announcement: next(text) }),
      undo: () => {
        const { session: current, past, future } = get();
        const step = past.at(-1);
        if (!step) {
          set({ announcement: next('Nothing to undo.') });
          return;
        }
        set({
          toast: undefined,
          session: step.session,
          announcement: next(`Undone: ${step.announcement}`),
          past: past.slice(0, -1),
          future: [...future, { session: current, announcement: step.announcement }],
        });
      },
      redo: () => {
        const { session: current, past, future } = get();
        const step = future.at(-1);
        if (!step) {
          set({ announcement: next('Nothing to redo.') });
          return;
        }
        set({
          toast: undefined,
          session: step.session,
          announcement: next(`Redone: ${step.announcement}`),
          past: [...past, { session: current, announcement: step.announcement }],
          future: future.slice(0, -1),
        });
      },
    };
  });
}

const SessionStoreContext = createContext<StoreApi<SessionStore> | null>(null);

export function SessionStoreProvider({ store, children }: { store?: StoreApi<SessionStore>; children: ReactNode }) {
  const [value] = useState(() => store ?? createSessionStore());
  return createElement(SessionStoreContext.Provider, { value }, children);
}

export function useSessionStore<T>(selector: (store: SessionStore) => T): T {
  return useStore(useSessionStoreApi(), selector);
}

/** The store itself, for handlers that read its latest state without re-rendering on every change. */
export function useSessionStoreApi(): StoreApi<SessionStore> {
  const store = useContext(SessionStoreContext);
  if (!store) throw new Error('useSessionStore needs a SessionStoreProvider');
  return store;
}
