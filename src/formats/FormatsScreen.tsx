import { useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import { FormatSummary } from '../components/FormatSummary';
import { NameDialog } from '../components/NameDialog';
import { PRESETS, SOLO_PVE, type Format, type FormatItem } from '../model/format';
import { duplicateFormat, validateFormatName } from '../model/formatNames';
import '../editor/LayoutEditor.css';
import { DeleteFormatDialog } from './DeleteFormatDialog';
import { useFormats } from './FormatsProvider';

const byName = (a: FormatItem, b: FormatItem) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });

interface FormatsScreenProps {
  /** Called once the screen has closed: Esc or Back to table. */
  onClose: () => void;
}

/**
 * The full-screen Formats screen (FS-2), opened from the toolbar and loaded on
 * first use (PF-3). It lists the presets, which can only be duplicated, and the
 * saved formats, which can be renamed, duplicated and deleted. It reuses the
 * layout screen's frame: a modal <dialog> over the table.
 */
export default function FormatsScreen({ onClose }: FormatsScreenProps) {
  const { formats, saveFormat, deleteFormat } = useFormats();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const [renaming, setRenaming] = useState<FormatItem>();
  const [deleting, setDeleting] = useState<FormatItem>();
  const [announcement, setAnnouncement] = useState({ id: 0, text: '' });
  /** The row and button to focus once the list has rendered, after an action or a dialog. */
  const pendingFocus = useRef<{ id: string; action: 'rename' | 'duplicate' | 'delete' }>(undefined);
  /** Where focus goes once the delete dialog closes after a delete. */
  const afterDelete = useRef<{ id: string; action: 'rename' | 'duplicate' }>(undefined);
  /** Set from a rename until the next key event: see `openRename`. */
  const renameKeyHeld = useRef(false);

  const sorted = [...formats].sort(byName);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    backRef.current?.focus();
  }, []);

  // Runs after every render, so it finds rows that have just appeared.
  useEffect(() => {
    const pending = pendingFocus.current;
    if (!pending) return;
    pendingFocus.current = undefined;
    dialogRef.current?.querySelector<HTMLElement>(`[data-format-id="${pending.id}"] [data-action="${pending.action}"]`)?.focus();
  });

  function announce(text: string) {
    setAnnouncement((current) => ({ id: current.id + 1, text }));
  }

  function duplicate(source: Format) {
    const copy = duplicateFormat(formats, source);
    saveFormat(copy);
    announce(`Duplicated ${source.name} as ${copy.name}.`);
    pendingFocus.current = { id: copy.id, action: 'rename' };
  }

  // Enter in the name field submits on keydown, and the closing dialog hands focus
  // straight back to the row's Rename button, which the same key's keypress would
  // click. That click, made by the key that renamed, is ignored.
  function openRename(event: MouseEvent, format: FormatItem) {
    if (event.detail === 0 && renameKeyHeld.current) return;
    setRenaming(format);
  }

  function rename(name: string) {
    if (!renaming) return;
    saveFormat({ ...renaming, name });
    announce(`Renamed ${renaming.name} to ${name}.`);
    renameKeyHeld.current = true;
    const release = () => {
      renameKeyHeld.current = false;
    };
    document.addEventListener('keyup', release, { once: true, capture: true });
    document.addEventListener('keydown', release, { once: true, capture: true });
  }

  /** Whether focus is on a row already, where the closing dialog usually puts it back itself. */
  function focusInList(): boolean {
    const active = document.activeElement;
    return active instanceof HTMLElement && active.closest('.layout-list') !== null;
  }

  function closeRename() {
    if (renaming && !focusInList()) pendingFocus.current = { id: renaming.id, action: 'rename' };
    setRenaming(undefined);
  }

  function remove() {
    if (!deleting) return;
    const index = sorted.findIndex((format) => format.id === deleting.id);
    const next = sorted[index + 1] ?? sorted[index - 1];
    deleteFormat(deleting.id);
    announce(`Deleted ${deleting.name}.`);
    // Focus moves to the next row, else the one before, else the last preset's Duplicate.
    afterDelete.current = next ? { id: next.id, action: 'rename' } : { id: (PRESETS[PRESETS.length - 1] ?? SOLO_PVE).id, action: 'duplicate' };
  }

  function closeDelete() {
    // Cancelled, focus goes back to the row's Delete button.
    if (afterDelete.current) pendingFocus.current = afterDelete.current;
    else if (deleting && !focusInList()) pendingFocus.current = { id: deleting.id, action: 'delete' };
    afterDelete.current = undefined;
    setDeleting(undefined);
  }

  return (
    <dialog
      ref={dialogRef}
      className="layout-editor"
      aria-labelledby={titleId}
      // Nested dialogs' close events reach here too; only act on our own.
      onClose={(event) => event.target === event.currentTarget && onClose()}
    >
      <header className="layout-editor__header">
        <button ref={backRef} type="button" className="button layout-editor__back" onClick={() => dialogRef.current?.close()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
          Back to table
        </button>
        <h2 id={titleId} className="layout-editor__title">
          Formats
        </h2>
      </header>

      <div className="layout-editor__body">
        <ul className="layout-list" aria-labelledby={titleId}>
          {PRESETS.map((preset) => (
            <Row key={preset.id} format={preset} meta="Built in" onDuplicate={() => duplicate(preset)} />
          ))}
          {sorted.map((format) => (
            <Row
              key={format.id}
              format={format}
              onRename={(event) => openRename(event, format)}
              onDuplicate={() => duplicate(format)}
              onDelete={() => setDeleting(format)}
            />
          ))}
        </ul>
      </div>

      <div role="status" aria-live="polite" className="visually-hidden">
        <span key={announcement.id}>{announcement.text}</span>
      </div>

      <NameDialog
        key={renaming?.id}
        item={renaming}
        validateName={(name, exceptId) => validateFormatName(formats, name, exceptId)}
        onConfirm={rename}
        onClose={closeRename}
      />
      <DeleteFormatDialog format={deleting} onConfirm={remove} onClose={closeDelete} />
    </dialog>
  );
}

interface RowProps {
  format: Format;
  meta?: string;
  onRename?: (event: MouseEvent) => void;
  onDuplicate: () => void;
  onDelete?: () => void;
}

function Row({ format, meta, onRename, onDuplicate, onDelete }: RowProps) {
  return (
    <li className="layout-list__row" data-format-id={format.id}>
      <div className="layout-list__text">
        <span className="layout-list__name">{format.name}</span>
        {meta && <span className="layout-list__meta">{meta}</span>}
        <FormatSummary format={format} />
      </div>
      <div className="layout-list__actions">
        {onRename && (
          <button type="button" className="button" data-action="rename" aria-label={`Rename ${format.name}`} onClick={onRename}>
            Rename
          </button>
        )}
        <button type="button" className="button" data-action="duplicate" aria-label={`Duplicate ${format.name}`} onClick={onDuplicate}>
          Duplicate
        </button>
        {onDelete && (
          <button type="button" className="button" data-action="delete" aria-label={`Delete ${format.name}`} onClick={onDelete}>
            Delete
          </button>
        )}
      </div>
    </li>
  );
}
