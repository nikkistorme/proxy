import { lazy, Suspense, useCallback, useRef, useState } from 'react';
import { newItemId } from '../storage/storage';
import { useSavedItems } from '../storage/useSavedItems';
import { useSessionStoreApi } from '../store/sessionStore';
import type { SnapshotItem } from '../store/snapshotItem';
import { ImportDialogs } from './BundleDialogs';
import { Menu } from './Menu';
import { NameDialog } from './NameDialog';
import { SessionLog } from './SessionLog';
import { SetupDialog } from './SetupDialog';
import { SnapshotsDialog, validateSnapshotName } from './SnapshotsDialog';
import { useSessionBundle } from './useSessionBundle';
import './SessionMenu.css';

const FormatsScreen = lazy(() => import('../formats/FormatsScreen'));

const NEW_ICON = 'M12 5v14M5 12h14';
const SAVE_ICON = 'M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6';
const SNAPSHOTS_ICON = 'M12 7v5l3 2M4 12a8 8 0 1 0 2.5-5.8M4 4v4h4';
const EXPORT_ICON = 'M12 15V4M8 8l4-4 4 4M5 14v6h14v-6';
const IMPORT_ICON = 'M12 4v11M8 11l4 4 4-4M5 14v6h14v-6';
const LOG_ICON = 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01';

/**
 * The session's own menu in the header. It says "This session" until sessions
 * have names. It starts a new session, saves and loads snapshots (PS-3), exports
 * and imports a bundle (PS-4) and opens the session log (TT-14).
 */
export function SessionMenu() {
  const [menuOpen, setMenuOpen] = useState(false);
  /** When the log opened, or undefined while it's closed. */
  const [logOpenedAt, setLogOpenedAt] = useState<number>();
  /** When the setup dialog opened, or undefined while it's closed. */
  const [setupOpenedAt, setSetupOpenedAt] = useState<number>();
  /** The Formats screen while it's open (FS-2), reached from the setup dialog. `chosenId` is the format to select when the setup dialog comes back. */
  const [formatsScreen, setFormatsScreen] = useState<{ chosenId: string; editId?: string; message?: string }>();
  /** Set while the setup dialog closes to hand over to the Formats screen, so its close doesn't move focus to the menu button. */
  const handingOver = useRef(false);
  /** The format the reopened setup dialog starts on. */
  const [initialId, setInitialId] = useState<string>();
  /** PS-3: set while the Save snapshot dialog is open. Its `key` is when it opened. */
  const [savingAt, setSavingAt] = useState<number>();
  /** When the Snapshots dialog opened, or undefined while it's closed. */
  const [snapshotsOpenedAt, setSnapshotsOpenedAt] = useState<number>();
  const store = useSessionStoreApi();
  const { items: snapshots, save: saveSnapshot, remove: removeSnapshot } = useSavedItems<SnapshotItem>('snapshot', 0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bundle = useSessionBundle(snapshots);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    buttonRef.current?.focus();
  }, []);

  function openFormats(screen: { chosenId: string; editId?: string; message?: string }) {
    handingOver.current = true;
    setFormatsScreen(screen);
    setSetupOpenedAt(undefined);
  }

  // Back and Esc on the Formats screen return to the setup dialog, on the format chosen before.
  function closeFormats() {
    handingOver.current = false;
    setInitialId(formatsScreen?.chosenId);
    setFormatsScreen(undefined);
    setSetupOpenedAt(Date.now());
  }

  return (
    <span className="session-menu">
      <button
        ref={buttonRef}
        type="button"
        className="session-menu__button"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        This session
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {menuOpen && (
        <Menu
          label="This session"
          header="This session"
          entries={[
            { kind: 'item', id: 'new', label: 'New session…', icon: NEW_ICON, onSelect: () => {
                setInitialId(undefined);
                setSetupOpenedAt(Date.now());
              },
            },
            { kind: 'item', id: 'save-snapshot', label: 'Save snapshot…', icon: SAVE_ICON, onSelect: () => setSavingAt(Date.now()) },
            { kind: 'item', id: 'snapshots', label: 'Snapshots…', icon: SNAPSHOTS_ICON, onSelect: () => setSnapshotsOpenedAt(Date.now()) },
            { kind: 'item', id: 'export', label: 'Export session…', icon: EXPORT_ICON, onSelect: () => void bundle.exportSession() },
            {
              kind: 'item',
              id: 'import',
              label: 'Import bundle…',
              icon: IMPORT_ICON,
              onSelect: () => {
                if (bundle.canSave) fileRef.current?.click();
                else bundle.showError("Couldn't import a bundle. This browser can't save, so the bundle can't be imported.");
              },
            },
            { kind: 'item', id: 'log', label: 'Session log', icon: LOG_ICON, onSelect: () => setLogOpenedAt(Date.now()) },
          ]}
          onClose={closeMenu}
        />
      )}
      <SetupDialog
        key={setupOpenedAt}
        open={setupOpenedAt !== undefined}
        initialId={initialId}
        onEditFormats={(chosenId) => openFormats({ chosenId })}
        onEditCopy={(copy, message) => openFormats({ chosenId: copy.id, editId: copy.id, message })}
        onClose={(started) => {
          setSetupOpenedAt(undefined);
          if (handingOver.current) handingOver.current = false;
          else if (started) document.querySelector<HTMLElement>('.table-surface')?.focus();
          else buttonRef.current?.focus();
        }}
      />
      {formatsScreen && (
        <Suspense fallback={null}>
          <FormatsScreen onClose={closeFormats} backLabel="Back to New session" editId={formatsScreen.editId} announcement={formatsScreen.message} />
        </Suspense>
      )}
      <NameDialog
        key={savingAt}
        item={savingAt === undefined ? undefined : { id: 'new', name: `Snapshot ${snapshots.length + 1}` }}
        title="Save snapshot"
        primaryLabel="Save"
        hint="Enter save · Esc cancel"
        validateName={validateSnapshotName}
        onConfirm={(name) => {
          const { session, log } = store.getState();
          saveSnapshot({ id: newItemId(), name, state: session, log, savedAt: Date.now() });
          store.getState().announce(`Saved snapshot ${name}.`);
        }}
        onClose={() => {
          setSavingAt(undefined);
          buttonRef.current?.focus();
        }}
      />
      <SnapshotsDialog
        open={snapshotsOpenedAt !== undefined}
        snapshots={snapshots}
        onLoaded={() => setSnapshotsOpenedAt(undefined)}
        onRename={saveSnapshot}
        onDelete={removeSnapshot}
        onClose={(loaded) => {
          setSnapshotsOpenedAt(undefined);
          if (loaded) document.querySelector<HTMLElement>('.table-surface')?.focus();
          else buttonRef.current?.focus();
        }}
      />
      <input ref={fileRef} type="file" accept=".json,application/json" hidden data-testid="bundle-file" onChange={(event) => void bundle.chooseFile(event)} />
      <ImportDialogs
        pending={bundle.pending}
        error={bundle.error}
        onConfirm={bundle.confirm}
        onClose={() => {
          bundle.close();
          buttonRef.current?.focus();
        }}
      />
      <SessionLog
        openedAt={logOpenedAt}
        onClose={() => {
          setLogOpenedAt(undefined);
          buttonRef.current?.focus();
        }}
      />
    </span>
  );
}
