import { useLayoutEffect } from 'react';
import { SessionScreen } from './components/SessionScreen';
import { LayoutsProvider } from './layouts/LayoutsProvider';
import type { StorageBackend } from './storage/storage';
import { StorageProvider, useOption } from './storage/StorageProvider';
import { SessionStoreProvider } from './store/sessionStore';
import { applyTheme } from './theme';

/** Sets the theme from the resolved option (A11Y-9, AR-7). */
function Theme() {
  const preference = useOption('theme');
  useLayoutEffect(() => applyTheme(preference), [preference]);
  return null;
}

/** `storageBackend` swaps out IndexedDB, for tests (AR-6). */
export function App({ storageBackend }: { storageBackend?: StorageBackend }) {
  return (
    <StorageProvider backend={storageBackend}>
      <Theme />
      <LayoutsProvider>
        <SessionStoreProvider>
          <SessionScreen />
        </SessionStoreProvider>
      </LayoutsProvider>
    </StorageProvider>
  );
}
