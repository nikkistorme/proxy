import { useCallback, useState, type ChangeEvent } from 'react';
import { useFormats } from '../formats/FormatsProvider';
import { useLayouts } from '../layouts/LayoutsProvider';
import { BUNDLE_APP, bundleFileName, bundleItem, bundleToText, readBundle, type Bundle } from '../model/bundle';
import type { CardSet } from '../model/cardSet';
import type { Format } from '../model/format';
import type { Layout } from '../model/layout';
import { SAVE_VERSION, type StoredItem } from '../storage/storage';
import { useAccountSettings, useImportBundle, useStorage } from '../storage/StorageProvider';
import { useSessionStoreApi } from '../store/sessionStore';
import type { SnapshotItem } from '../store/snapshotItem';
import type { NewItem } from '../storage/storage';
import type { PendingImport } from './BundleDialogs';

/**
 * PS-4: exporting the session as a JSON bundle and importing one. Each kind
 * comes from where its freshest copy is: the session from the store, layouts,
 * formats and snapshots from the app, settings from the account, and card sets
 * from storage, where they are written straight away.
 */
export function useSessionBundle(snapshots: readonly NewItem<SnapshotItem>[]) {
  const store = useSessionStoreApi();
  const storage = useStorage();
  const { layouts } = useLayouts();
  const { formats } = useFormats();
  const settings = useAccountSettings();
  const { importBundle, available } = useImportBundle();
  const [pending, setPending] = useState<PendingImport>();
  const [error, setError] = useState<string>();

  const exportSession = useCallback(async () => {
    const { session, log, view, sessionId, announce } = store.getState();
    const cardSets = (await storage?.list<CardSet>('cardSet').catch(() => [])) ?? [];
    const bundle: Bundle = {
      app: BUNDLE_APP,
      version: SAVE_VERSION,
      exportedAt: new Date().toISOString(),
      session: { id: sessionId, state: session, log, zoom: view.zoom, snap: view.snap },
      snapshots: snapshots.map((snapshot) => bundleItem<SnapshotItem>(snapshot)),
      cardSets: cardSets.map((set) => bundleItem<CardSet>(set)),
      layouts: layouts.map((layout) => bundleItem<Layout>(layout)),
      formats: formats.map((format) => bundleItem<Format & StoredItem>(format)),
      settings: { id: 'account', options: settings.options },
    };
    const fileName = bundleFileName(session.formatName, new Date());
    const url = URL.createObjectURL(new Blob([bundleToText(bundle)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    // Firefox needs the URL a moment after the click.
    setTimeout(() => URL.revokeObjectURL(url), 0);
    announce(`Exported session to ${fileName}.`);
  }, [store, storage, snapshots, layouts, formats, settings.options]);

  /** Reads the chosen file. A bad one opens the error dialog; a good one waits for the confirm step. */
  const chooseFile = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    // Cleared so choosing the same file again still imports it.
    input.value = '';
    if (!file) return;
    const read = readBundle(await file.text());
    if ('error' in read) setError(`Couldn't import ${file.name}. ${read.error}`);
    else setPending({ fileName: file.name, bundle: read.bundle });
  }, []);

  const confirm = useCallback(
    (item: PendingImport) => {
      importBundle(item.bundle, item.fileName).catch(() => setError(`Couldn't import ${item.fileName}. This browser couldn't save it, so nothing was changed.`));
    },
    [importBundle],
  );

  const close = useCallback(() => {
    setPending(undefined);
    setError(undefined);
  }, []);

  return { exportSession, chooseFile, confirm, close, pending, error, canSave: available, showError: setError };
}
