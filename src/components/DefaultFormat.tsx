import { useEffect, useRef } from 'react';
import { presetById } from '../model/format';
import { useOption, useStorage } from '../storage/StorageProvider';
import { useSessionStoreApi } from '../store/sessionStore';

/**
 * SP-1: the session is created before saved options load, so once storage is
 * ready an untouched session switches to the saved default format, silently.
 * It runs once; later changes come from the setup dialog.
 */
export function DefaultFormat() {
  const storage = useStorage();
  const defaultFormat = useOption('defaultFormat');
  const store = useSessionStoreApi();
  const done = useRef(false);

  useEffect(() => {
    if (!storage || done.current) return;
    done.current = true;
    const { session, past, startSession } = store.getState();
    if (past.length === 0 && Object.keys(session.cards).length === 0 && session.formatId !== defaultFormat) {
      startSession(presetById(defaultFormat), { silent: true });
    }
  }, [storage, defaultFormat, store]);

  return null;
}
