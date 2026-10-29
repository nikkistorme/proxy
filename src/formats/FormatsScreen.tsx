import { useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import { FormatSummary } from '../components/FormatSummary';
import { NameDialog } from '../components/NameDialog';
import { PRESETS, SOLO_PVE, type Format, type FormatItem } from '../model/format';
import { duplicateFormat, validateFormatName } from '../model/formatNames';
import '../editor/LayoutEditor.css';
import { DeleteFormatDialog } from './DeleteFormatDialog';
import { FormatEditor } from './FormatEditor';
import { useFormats } from './FormatsProvider';

const byName = (a: FormatItem, b: FormatItem) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });

interface FormatsScreenProps {
  /** Called once the screen has closed: Esc or Back to table. */
  onClose: () => void;
  /** The back button's label. */
  backLabel?: string;
  /** A saved format to open in the editor straight away, like a copy just made. */
  editId?: string;
  /** Announced when the screen opens. */
  announcement?: string;
}

/**
 * The full-screen Formats screen (FS-2), opened from the setup dialog and loaded on
 * first use (PF-3). It lists the presets, which can only be duplicated, and the
 * saved formats, which can be edited, renamed, duplicated and deleted. A preset's
 * Edit a copy makes a saved copy and opens it. Edit opens a format's seats and
 * piles in the editor, in the same screen. It reuses the layout screen's frame:
 * a modal <dialog> over the table.
 */
export default function FormatsScreen({ onClose, backLabel = 'Back to table', editId, announcement: opening = '' }: FormatsScreenProps) {
  const { formats, saveFormat, deleteFormat } = useFormats();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const [renaming, setRenaming] = useState<FormatItem>();
  const [deleting, setDeleting] = useState<FormatItem>();
  /** The format open in the editor, if any. */
  const [editingId, setEditingId] = useState(editId);
  const [announcement, setAnnouncement] = useState({ id: 0, text: opening });
  /** The row and button to focus once the list has rendered, after an action or a dialog. */
  const pendingFocus = useRef<{ id: string; action: 'edit' | 'rename' | 'duplicate' | 'delete' } | undefined>(undefined);
  /** Where focus goes once the delete dialog closes after a delete. */
  const afterDelete = useRef<{ id: string; action: 'rename' | 'duplicate' }>(undefined);
  /** Set from a rename until the next key event: see `openRename`. */
  const renameKeyHeld = useRef(false);

  const sorted = [...formats].sort(byName);
  const editing = formats.find((format) => format.id === editingId);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  // Back is the first thing focused, on the list and on the editor (no text field on touch screens).
  useEffect(() => {
    backRef.current?.focus();
  }, [editing?.id]);

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

  // A preset's Edit a copy: the copy opens in the editor.
  function editCopy(source: Format) {
    const copy = duplicateFormat(formats, source);
    saveFormat(copy);
    announce(`Duplicated ${source.name} as ${copy.name}. Editing ${copy.name}.`);
    setEditingId(copy.id);
  }

  function openEditor(format: FormatItem) {
    setEditingId(format.id);
    announce(`Editing ${format.name}.`);
  }

  function closeEditor() {
    if (editing) pendingFocus.current = { id: editing.id, action: 'edit' };
    setEditingId(undefined);
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
      onCancel={(event) => {
        // Esc in the editor goes back to the list, not out of the screen.
        if (event.target !== event.currentTarget || !editing) return;
        event.preventDefault();
        closeEditor();
      }}
    >
      <header className="layout-editor__header">
        <button ref={backRef} type="button" className="button layout-editor__back" onClick={() => (editing ? closeEditor() : dialogRef.current?.close())}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
          {editing ? 'Back to formats' : backLabel}
        </button>
        <h2 id={titleId} className="layout-editor__title">
          Formats
        </h2>
      </header>

      <div className="layout-editor__body">
        {editing ? (
          <FormatEditor key={editing.id} format={editing} onChange={saveFormat} announce={announce} />
        ) : (
          <ul className="layout-list" aria-labelledby={titleId}>
            {PRESETS.map((preset) => (
              <Row key={preset.id} format={preset} meta="Built in" onDuplicate={() => editCopy(preset)} />
            ))}
            {sorted.map((format) => (
              <Row
                key={format.id}
                format={format}
                onEdit={() => openEditor(format)}
                onRename={(event) => openRename(event, format)}
                onDuplicate={() => duplicate(format)}
                onDelete={() => setDeleting(format)}
              />
            ))}
          </ul>
        )}
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
  onEdit?: () => void;
  onRename?: (event: MouseEvent) => void;
  onDuplicate: () => void;
  onDelete?: () => void;
}

function Row({ format, meta, onEdit, onRename, onDuplicate, onDelete }: RowProps) {
  return (
    <li className="layout-list__row" data-format-id={format.id}>
      <div className="layout-list__text">
        <span className="layout-list__name">{format.name}</span>
        {meta && <span className="layout-list__meta">{meta}</span>}
        <FormatSummary format={format} />
      </div>
      <div className="layout-list__actions">
        {onEdit && (
          <button type="button" className="button" data-action="edit" aria-label={`Edit ${format.name}`} onClick={onEdit}>
            Edit
          </button>
        )}
        {onRename && (
          <button type="button" className="button" data-action="rename" aria-label={`Rename ${format.name}`} onClick={onRename}>
            Rename
          </button>
        )}
        {/* A preset has nothing to change in place, so its copy opens in the editor. */}
        <button
          type="button"
          className="button"
          data-action="duplicate"
          aria-label={onEdit ? `Duplicate ${format.name}` : `Edit a copy of ${format.name}`}
          onClick={onDuplicate}
        >
          {onEdit ? 'Duplicate' : 'Edit a copy'}
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
