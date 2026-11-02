import { render, screen, waitFor } from '@testing-library/react';
import { lazy } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { sessionWithDeck, testContext } from '../actions/testing';
import { createSessionStore, SessionStoreProvider } from '../store/sessionStore';
import { ChunkBoundary } from './ChunkBoundary';

describe('PF-3 chunk boundary', () => {
  it('shows the toast, announces it and closes when the chunk fails, leaving the session alone', async () => {
    const store = createSessionStore(sessionWithDeck(), testContext());
    const before = store.getState().session;
    const Broken = lazy(() => Promise.reject<{ default: () => null }>(new Error('chunk failed')));
    const onClose = vi.fn();
    // React logs the caught error; the test expects it.
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <SessionStoreProvider store={store}>
        <ChunkBoundary screen="the pile viewer" onClose={onClose}>
          <Broken />
        </ChunkBoundary>
        <p>Table</p>
      </SessionStoreProvider>,
    );
    const message = "Couldn't open the pile viewer. Check your connection, then reload the page.";
    await waitFor(() => expect(store.getState().toast?.text).toBe(message));
    expect(store.getState().announcement.text).toBe(message);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(store.getState().session).toBe(before);
    expect(screen.getByText('Table')).toBeInTheDocument();
    log.mockRestore();
  });

  it('shows the child once its chunk has loaded', async () => {
    const store = createSessionStore(sessionWithDeck(), testContext());
    const Fine = lazy(() => Promise.resolve({ default: () => <p>Loaded</p> }));
    render(
      <SessionStoreProvider store={store}>
        <ChunkBoundary screen="the pile viewer" onClose={() => {}}>
          <Fine />
        </ChunkBoundary>
      </SessionStoreProvider>,
    );
    expect(await screen.findByText('Loaded')).toBeInTheDocument();
    expect(store.getState().toast).toBeUndefined();
  });
});
