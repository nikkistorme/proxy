import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PVP_1V1 } from '../model/format';
import { memoryBackend } from '../storage/backends';
import { itemKey, SAVE_VERSION } from '../storage/storage';
import { StorageProvider } from '../storage/StorageProvider';
import { FORMAT_SAVE_DELAY, FormatsProvider, useFormats } from './FormatsProvider';

const formatKey = (id: string) => itemKey(import.meta.env.BASE_URL, 'guest', 'format', id);
const mine = { ...PVP_1V1, id: 'f-mine', name: 'Mine', updatedAt: '', version: SAVE_VERSION };
const other = { ...PVP_1V1, id: 'f-other', name: 'Other', updatedAt: '', version: SAVE_VERSION };

function Probe() {
  const { formats, loaded, saveFormat, deleteFormat } = useFormats();
  return (
    <>
      <p data-testid="state">{`${loaded ? 'loaded' : 'loading'}: ${formats.map((f) => f.name).join(', ')}`}</p>
      <button type="button" onClick={() => saveFormat({ ...mine, name: 'Mine edited' })}>
        Save mine
      </button>
      <button type="button" onClick={() => deleteFormat('f-mine')}>
        Delete mine
      </button>
    </>
  );
}

function setup(items: Record<string, unknown>) {
  const backend = memoryBackend(items);
  render(
    <StorageProvider backend={backend}>
      <FormatsProvider>
        <Probe />
      </FormatsProvider>
    </StorageProvider>,
  );
  return backend;
}

const state = () => screen.getByTestId('state');

describe('FS-2 saved formats', () => {
  it('lists the saved formats once storage is read, then reports loaded', async () => {
    setup({ [formatKey('f-mine')]: mine });
    expect(state()).toHaveTextContent('loading:');
    await waitFor(() => expect(state()).toHaveTextContent('loaded: Mine'));
  });

  it('is loaded with no formats when none are saved', async () => {
    setup({});
    await waitFor(() => expect(state().textContent).toBe('loaded: '));
  });

  it('a deleted format stays deleted and its item is removed', async () => {
    const backend = setup({ [formatKey('f-mine')]: mine, [formatKey('f-other')]: other });
    await waitFor(() => expect(state()).toHaveTextContent('loaded'));
    await userEvent.click(screen.getByRole('button', { name: 'Delete mine' }));
    expect(state()).not.toHaveTextContent('Mine');
    await waitFor(() => expect(backend.data.has(formatKey('f-mine'))).toBe(false));
    expect(backend.data.has(formatKey('f-other'))).toBe(true);
  });
});

describe('PS-1 formats autosave as their own items', () => {
  it('saves only the changed format, at most once a second', async () => {
    const backend = setup({ [formatKey('f-mine')]: mine, [formatKey('f-other')]: other });
    await waitFor(() => expect(state()).toHaveTextContent('loaded: Mine'));
    const set = vi.spyOn(backend, 'set');
    vi.useFakeTimers();
    try {
      const save = screen.getByRole('button', { name: 'Save mine' });
      act(() => save.click());
      act(() => save.click());
      act(() => vi.advanceTimersByTime(FORMAT_SAVE_DELAY - 1));
      expect(set).not.toHaveBeenCalled();
      await act(async () => vi.advanceTimersByTime(1));
      expect(set).toHaveBeenCalledTimes(1);
      expect(set).toHaveBeenCalledWith(formatKey('f-mine'), expect.objectContaining({ name: 'Mine edited', version: SAVE_VERSION }));
      expect(backend.data.get(formatKey('f-other'))).toEqual(other);
    } finally {
      vi.useRealTimers();
    }
  });

  it('saves what’s waiting when the page is hidden', async () => {
    const backend = setup({});
    await waitFor(() => expect(state()).toHaveTextContent('loaded'));
    await userEvent.click(screen.getByRole('button', { name: 'Save mine' }));
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    await waitFor(() => expect(backend.data.has(formatKey('f-mine'))).toBe(true));
  });
});
