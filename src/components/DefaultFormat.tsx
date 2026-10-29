import { useEffect, useRef } from 'react';
import { useFormats } from '../formats/FormatsProvider';
import { formatById } from '../model/format';
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
  const { formats, loaded } = useFormats();
  const store = useSessionStoreApi();
  const done = useRef(false);

  useEffect(() => {
    if (!storage || !loaded || done.current) return;
    done.current = true;
    const { session, past, startSession } = store.getState();
    // A default that was deleted gives Solo PvE.
    const wanted = formatById(formats, defaultFormat);
    if (past.length === 0 && Object.keys(session.cards).length === 0 && session.formatId !== wanted.id) {
      startSession(wanted, { silent: true });
    }
  }, [storage, loaded, formats, defaultFormat, store]);

  return null;
}
