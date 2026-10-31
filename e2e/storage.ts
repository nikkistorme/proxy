import type { Page } from '@playwright/test';

/** The parts of the saved session item (`src/store/sessionItem.ts`) that tests look at. */
export interface StoredSession {
  updatedAt: string;
  state: {
    activeSeatId: string;
    seats: { id: string }[];
    hands: Record<string, string[]>;
    table: unknown[];
  };
}

/**
 * The saved session item, or undefined when none is stored yet (PS-1). Autosave
 * runs up to a second after a change, so a test waits for it with `expect.poll`
 * before a reload or a storage check, never for a fixed time.
 */
export async function storedSession(page: Page): Promise<StoredSession | undefined> {
  return page.evaluate(
    () =>
      new Promise<StoredSession | undefined>((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onupgradeneeded = () => open.result.createObjectStore('keyval');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const store = open.result.transaction('keyval').objectStore('keyval');
          const request = store.getAllKeys();
          request.onsuccess = () => {
            const key = request.result.find((k) => String(k).split('|')[2] === 'session');
            if (key === undefined) {
              open.result.close();
              resolve(undefined);
              return;
            }
            const got = store.get(key);
            got.onsuccess = () => {
              open.result.close();
              resolve(got.result as StoredSession);
            };
            got.onerror = () => reject(got.error);
          };
          request.onerror = () => reject(request.error);
        };
      }),
  );
}
