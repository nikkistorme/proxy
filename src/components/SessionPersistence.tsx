import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useFormats } from '../formats/FormatsProvider';
import { formatById } from '../model/format';
import { useCurrentSession, useOption, useStorage } from '../storage/StorageProvider';
import { useSavedItems } from '../storage/useSavedItems';
import { decodeShared, encodeShared } from '../model/sharedEncoding';
import { SESSION_SAVE_DELAY, type SavedHistory, type SessionItem } from '../store/sessionItem';
import { HISTORY_LIMIT, useSessionStoreApi, type HistoryEntry, type SessionStore } from '../store/sessionStore';
import './SessionPersistence.css';

/** If reading the saved session never finishes, the app stops waiting after this long. */
export const LOAD_TIMEOUT = 5000;

function toItem(state: SessionStore): Omit<SessionItem, 'updatedAt' | 'version'> {
  const history: SavedHistory = { session: state.session, past: state.past.slice(-HISTORY_LIMIT), future: state.future.slice(-HISTORY_LIMIT) };
  return { id: state.sessionId, state: state.session, log: state.log, zoom: state.view.zoom, snap: state.view.snap, history: encodeShared(history) };
}

const isEntries = (value: unknown): value is HistoryEntry[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'object' && entry !== null && typeof entry.announcement === 'string' && typeof entry.session === 'object' && entry.session !== null);

/** The saved undo history, or nothing when it is missing or can't be read: the session still comes back (PS-2). */
function readHistory(saved: Pick<SessionItem, 'history'>): SavedHistory | undefined {
  if (!saved.history) return undefined;
  try {
    const decoded = decodeShared(saved.history) as Partial<SavedHistory> | null;
    if (!decoded || typeof decoded.session !== 'object' || decoded.session === null || !isEntries(decoded.past) || !isEntries(decoded.future)) return undefined;
    return decoded as SavedHistory;
  } catch {
    return undefined;
  }
}

/**
 * PS-1, PS-2, SP-1: the session is created blank before storage is ready. Once
 * storage and the formats have loaded, the saved current session comes back
 * (Resume); without one, a new session starts from the `defaultFormat` option.
 * Then every change autosaves. Until then the app beneath is inert, behind a
 * loading overlay.
 */
export function SessionPersistence({ children }: { children: ReactNode }) {
  const storage = useStorage();
  const defaultFormat = useOption('defaultFormat');
  const { formats, loaded: formatsLoaded } = useFormats();
  const { currentSessionId, setCurrentSessionId } = useCurrentSession();
  const { items, loaded: itemsLoaded, save, remove } = useSavedItems<SessionItem>('session', SESSION_SAVE_DELAY);
  const store = useSessionStoreApi();
  const [ready, setReady] = useState(false);
  /** Set when the safety timeout fired: this visit works but saves nothing, so a slow read can't overwrite a saved session. */
  const [gaveUp, setGaveUp] = useState(false);
  const started = useRef(false);
  const latest = useRef({ defaultFormat, formats });
  useEffect(() => {
    latest.current = { defaultFormat, formats };
  });
  const shell = useRef<HTMLDivElement>(null);

  // A11Y: the app can't be used until the session is read. Set before the first paint.
  useLayoutEffect(() => {
    shell.current?.toggleAttribute('inert', !ready);
  }, [ready]);

  const startFromDefault = () => {
    const { session, past, startSession } = store.getState();
    // A default that was deleted gives Solo PvE.
    const wanted = formatById(latest.current.formats, latest.current.defaultFormat);
    if (past.length === 0 && Object.keys(session.cards).length === 0 && session.formatId !== wanted.id) {
      startSession(wanted, { silent: true });
    }
  };

  useEffect(() => {
    if (ready) return;
    const timer = setTimeout(() => {
      if (started.current) return;
      started.current = true;
      startFromDefault();
      setGaveUp(true);
      setReady(true);
    }, LOAD_TIMEOUT);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Resume, or start from the default format, once everything it needs has loaded.
  useEffect(() => {
    if (!storage || !itemsLoaded || !formatsLoaded || started.current) return;
    started.current = true;
    const state = store.getState();
    const touched = state.past.length > 0 || Object.keys(state.session.cards).length > 0;
    const saved = currentSessionId ? items.find((item) => item.id === currentSessionId) : undefined;
    let restored = false;
    if (touched) {
      // Something was done before storage was ready, so the session in memory wins.
    } else if (saved) {
      const history = readHistory(saved);
      state.restoreSession({
        id: saved.id,
        session: history?.session ?? saved.state,
        log: saved.log,
        zoom: saved.zoom,
        snap: saved.snap,
        past: history?.past.slice(-HISTORY_LIMIT),
        future: history?.future.slice(-HISTORY_LIMIT),
      });
      restored = true;
    } else {
      startFromDefault();
    }
    const current = store.getState();
    if (!restored) save(toItem(current));
    if (currentSessionId !== current.sessionId) setCurrentSessionId(current.sessionId);
    // Only the current session is kept.
    items.filter((item) => item.id !== current.sessionId).forEach((item) => remove(item.id));
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storage, itemsLoaded, formatsLoaded]);

  // Save every change, and move to a new session when New session… makes one.
  useEffect(() => {
    if (!ready || gaveUp) return;
    let previous = store.getState();
    return store.subscribe((state) => {
      const changed = state.session !== previous.session || state.log !== previous.log || state.view.zoom !== previous.view.zoom || state.view.snap !== previous.view.snap || state.sessionId !== previous.sessionId;
      if (!changed) {
        previous = state;
        return;
      }
      if (state.sessionId !== previous.sessionId) {
        remove(previous.sessionId);
        setCurrentSessionId(state.sessionId);
      }
      previous = state;
      save(toItem(state));
    });
  }, [ready, gaveUp, store, save, remove, setCurrentSessionId]);

  return (
    <>
      <div ref={shell} className="session-shell">
        {children}
      </div>
      {!ready && (
        <div className="loading-overlay" role="status">
          <span className="loading-overlay__spinner" aria-hidden="true" />
          Loading your session…
        </div>
      )}
    </>
  );
}
