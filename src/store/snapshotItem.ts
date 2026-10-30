import type { SessionState } from '../model/session';
import type { StoredItem } from '../storage/storage';
import type { LogEntry } from './sessionStore';

/**
 * PS-3: a named point in a session, as its own saved item. It keeps the session
 * state and the log, not the undo history, zoom or grid snap. It isn't tied to
 * any session, so New session… leaves snapshots alone.
 */
export interface SnapshotItem extends StoredItem {
  name: string;
  state: SessionState;
  log: LogEntry[];
  /** When it was saved, in ms. Kept apart from `updatedAt`, which changes on rename. */
  savedAt: number;
}

/** A snapshot name is at most this long (PS-3). */
export const SNAPSHOT_NAME_LIMIT = 60;
