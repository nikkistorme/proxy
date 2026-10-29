import type { SessionState } from '../model/session';
import type { StoredItem } from '../storage/storage';
import type { LogEntry } from './sessionStore';

/**
 * PS-1, PS-2: a session as its own saved item. It holds the state, the log
 * (TT-14) and the table's zoom and grid snap. Not the scroll position, the
 * cards-per-row, or the last roll shown (that's in the log). Undo history
 * isn't saved yet.
 */
export interface SessionItem extends StoredItem {
  state: SessionState;
  log: LogEntry[];
  zoom: number;
  snap: boolean;
}

/** Autosave waits this long after a session's first unsaved change, so it saves at most once a second (PS-1). */
export const SESSION_SAVE_DELAY = 1000;
