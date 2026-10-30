import { useEffect, useRef, useState } from 'react';
import type { NewItem } from '../storage/storage';
import { SNAPSHOT_NAME_LIMIT, type SnapshotItem } from '../store/snapshotItem';
import { useSessionStoreApi } from '../store/sessionStore';
import { Dialog } from './Dialog';
import { NameDialog } from './NameDialog';
import './Form.css';
import './SnapshotsDialog.css';

type Snapshot = NewItem<SnapshotItem>;

/** PS-3: why a snapshot name can't be used, or undefined. Names needn't be unique; the list shows when each was saved. */
export function validateSnapshotName(name: string): string | undefined {
  if (name.trim() === '') return 'A snapshot needs a name';
  if (name.trim().length > SNAPSHOT_NAME_LIMIT) return `A snapshot name can be at most ${SNAPSHOT_NAME_LIMIT} characters`;
  return undefined;
}

/** "Oct 29, 2026, 3:45 PM", in the viewer's locale. */
export function formatSavedAt(at: number): string {
  return new Date(at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

interface SnapshotsDialogProps {
  open: boolean;
  snapshots: Snapshot[];
  onRename: (snapshot: Snapshot) => void;
  onDelete: (id: string) => void;
  /** Called after a snapshot has loaded; the owner closes the dialog. */
  onLoaded: () => void;
  /** Called once the dialog has closed. `loaded` is true when it closed because a snapshot was loaded. */
  onClose: (loaded: boolean) => void;
}

/**
 * PS-3: the saved snapshots, newest first, each with Load, Rename and Delete.
 * Loading needs no confirm step because it is an undo step.
 */
export function SnapshotsDialog({ open, snapshots, onRename, onDelete, onLoaded, onClose }: SnapshotsDialogProps) {
  const store = useSessionStoreApi();
  const sorted = [...snapshots].sort((a, b) => b.savedAt - a.savedAt);
  const [renaming, setRenaming] = useState<Snapshot>();
  const [deleting, setDeleting] = useState<Snapshot>();
  const loaded = useRef(false);
  /** Where focus goes once the list has re-rendered after a delete: the next row's Delete button, or the empty message. */
  const focusAfter = useRef<string | 'empty'>();
  const emptyRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const target = focusAfter.current;
    if (!target) return;
    focusAfter.current = undefined;
    if (target === 'empty') emptyRef.current?.focus();
    else document.querySelector<HTMLElement>(`[data-snapshot="${target}"] [data-action="delete"]`)?.focus();
  }, [snapshots]);

  function load(snapshot: Snapshot) {
    loaded.current = true;
    store.getState().loadSnapshot(snapshot);
    onLoaded();
  }

  function rename(name: string) {
    if (!renaming) return;
    const old = renaming.name;
    onRename({ ...renaming, name });
    store.getState().announce(`Renamed snapshot ${old} to ${name}.`);
  }

  function remove() {
    if (!deleting) return;
    const index = sorted.findIndex((snapshot) => snapshot.id === deleting.id);
    const neighbour = sorted[index + 1] ?? sorted[index - 1];
    onDelete(deleting.id);
    store.getState().announce(`Deleted snapshot ${deleting.name}.`);
    focusAfter.current = neighbour ? neighbour.id : 'empty';
  }

  return (
    <>
      <Dialog
        open={open}
        title="Snapshots"
        width="medium"
        primaryLabel="Done"
        onClose={() => {
          const wasLoaded = loaded.current;
          loaded.current = false;
          onClose(wasLoaded);
        }}
      >
        {sorted.length === 0 ? (
          <p ref={emptyRef} tabIndex={-1} className="snapshots__empty">
            No snapshots yet. Choose Save snapshot… in the This session menu to keep this point in the session.
          </p>
        ) : (
          <ul className="snapshots" aria-label="Snapshots, newest first">
            {sorted.map((snapshot) => (
              <li key={snapshot.id} className="snapshots__row" data-snapshot={snapshot.id}>
                <div className="snapshots__info">
                  <span className="snapshots__name">{snapshot.name}</span>
                  <span className="snapshots__meta">
                    {formatSavedAt(snapshot.savedAt)} · {snapshot.state.formatName}
                  </span>
                </div>
                <div className="snapshots__actions">
                  <button type="button" className="button button--primary" data-action="load" aria-label={`Load ${snapshot.name}`} onClick={() => load(snapshot)}>
                    Load
                  </button>
                  <button type="button" className="button" data-action="rename" aria-label={`Rename ${snapshot.name}`} onClick={() => setRenaming(snapshot)}>
                    Rename
                  </button>
                  <button type="button" className="button" data-action="delete" aria-label={`Delete ${snapshot.name}`} onClick={() => setDeleting(snapshot)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Dialog>
      <NameDialog
        key={renaming?.id}
        item={renaming}
        validateName={validateSnapshotName}
        onConfirm={rename}
        // The browser returns focus to the row's Rename button.
        onClose={() => setRenaming(undefined)}
      />
      <Dialog
        open={deleting !== undefined}
        title={deleting ? `Delete snapshot ${deleting.name}?` : ''}
        hint="Enter delete · Esc cancel"
        primaryLabel="Delete snapshot"
        cancelLabel="Cancel"
        width="narrow"
        onClose={() => setDeleting(undefined)}
        onSubmit={() => {
          remove();
          return true;
        }}
      >
        <p className="form-text">This can't be undone.</p>
      </Dialog>
    </>
  );
}
