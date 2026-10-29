import type { SessionState } from '../model/session';
import type { StoredItem } from '../storage/storage';
import type { SharedEncoded } from '../model/sharedEncoding';
import type { HistoryEntry, LogEntry } from './sessionStore';

/**
 * PS-1, PS-2: a session as its own saved item. It holds the state, the log
 * (TT-14) and the table's zoom and grid snap. Not the scroll position, the
 * cards-per-row, or the last roll shown (that's in the log). The undo and redo
 * steps are `history`.
 */
export interface SessionItem extends StoredItem {
  state: SessionState;
  log: LogEntry[];
  zoom: number;
  snap: boolean;
  /**
   * PS-2: `encodeShared` of a `SavedHistory`, so steps that share parts of the
   * session are written once. Missing in items saved before 7b.
   */
  history?: SharedEncoded;
}

/** What `history` decodes to. The current session is in it too, so it shares parts with the steps after a restore. */
export interface SavedHistory {
  session: SessionState;
  past: HistoryEntry[];
  future: HistoryEntry[];
}

/** Autosave waits this long after a session's first unsaved change, so it saves at most once a second (PS-1). */
export const SESSION_SAVE_DELAY = 1000;
