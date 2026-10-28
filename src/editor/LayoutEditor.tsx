import { useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import { CardFace } from '../components/CardFace';
import { useLayouts, type LayoutItem } from '../layouts/LayoutsProvider';
import { DEFAULT_LAYOUT, type LayoutDesign } from '../model/layout';
import { duplicateLayout, newLayout, validateLayoutName } from '../model/layoutNames';
import type { PreviewPosition, PreviewSet } from '../model/preview';
import { DeleteLayoutDialog } from './DeleteLayoutDialog';
import { LayoutChoices } from './LayoutChoices';
import { LayoutCanvas } from './LayoutCanvas';
import './LayoutEditor.css';
import { LayoutNameDialog } from './LayoutNameDialog';

/** The built-in layout's row id. It can be duplicated, not renamed or deleted. */
const BUILT_IN = 'built-in';
const NEW_LAYOUT = 'new';
const SAMPLE_FACE = { name: 'Card name', fields: {} };

const byName = (a: LayoutItem, b: LayoutItem) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });

function describe(layout: LayoutDesign): string {
  const orientation = layout.orientation === 'landscape' ? 'Landscape' : 'Portrait';
  const count = layout.boxes.length;
  return `${orientation} · ${count} ${count === 1 ? 'box' : 'boxes'}`;
}

interface LayoutEditorProps {
  /** Called once the screen has closed: Esc or Back to table. */
  onClose: () => void;
  /** Column names from the loaded cards, suggested for column boxes (LY-3). */
  columns?: readonly string[];
  /** The loaded card sets, previewed on the canvas (LY-7). */
  previewSets?: readonly PreviewSet[];
  /** Card types in the loaded cards, to map to layouts (LY-8). */
  types?: readonly string[];
}

/**
 * The full-screen layout screen (LY-1), opened from the toolbar and loaded on
 * first use (PF-3). It lists the layouts, with create, rename, duplicate and
 * delete, and Edit opens a layout on the canvas (LY-2) in the same screen.
 * It's a modal <dialog>, so the table stays as it was underneath.
 */
export default function LayoutEditor({ onClose, columns, previewSets, types }: LayoutEditorProps) {
  const { layouts, saveLayout, deleteLayout } = useLayouts();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const newRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const [renaming, setRenaming] = useState<LayoutItem>();
  const [deleting, setDeleting] = useState<LayoutItem>();
  /** The layout open on the canvas, if any. */
  const [editingId, setEditingId] = useState<string>();
  /** The card the canvas previews, kept while moving between layouts (LY-7). */
  const [preview, setPreview] = useState<PreviewPosition>({ index: 0 });
  /** Whether canvas boxes snap to the grid (LY-2). On to start, and kept while moving between layouts, not saved. */
  const [snap, setSnap] = useState(true);
  const [announcement, setAnnouncement] = useState({ id: 0, text: '' });
  /** The row and button to focus once the list has rendered, after an action or a dialog. */
  const pendingFocus = useRef<{ id: string; action: 'edit' | 'rename' | 'delete' }>(undefined);
  /** Where focus goes once the delete dialog closes after a delete. */
  const afterDelete = useRef<{ id: string; action: 'rename' }>(undefined);

  const sorted = [...layouts].sort(byName);
  const editing = layouts.find((layout) => layout.id === editingId);
  /** Set from a rename until the next key event: see `openRename`. */
  const renameKeyHeld = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    newRef.current?.focus();
  }, []);

  // Runs after every render, so it finds rows that have just appeared.
  useEffect(() => {
    const pending = pendingFocus.current;
    if (!pending) return;
    pendingFocus.current = undefined;
    if (pending.id === NEW_LAYOUT) newRef.current?.focus();
    else dialogRef.current?.querySelector<HTMLElement>(`[data-layout-id="${pending.id}"] [data-action="${pending.action}"]`)?.focus();
  });

  function announce(text: string) {
    setAnnouncement((current) => ({ id: current.id + 1, text }));
  }

  function add(layout: LayoutItem, message: string) {
    saveLayout(layout);
    announce(message);
    pendingFocus.current = { id: layout.id, action: 'rename' };
  }

  function create() {
    const layout = newLayout(layouts);
    add(layout, `Created ${layout.name}.`);
  }

  function duplicate(source: LayoutDesign) {
    const copy = duplicateLayout(layouts, source);
    add(copy, `Duplicated ${source.name} as ${copy.name}.`);
  }

  // Enter in the name field submits on keydown, and the closing dialog hands focus
  // straight back to the row's Rename button, which the same key's keypress would
  // click. That click, made by the key that renamed, is ignored.
  function openRename(event: MouseEvent, layout: LayoutItem) {
    if (event.detail === 0 && renameKeyHeld.current) return;
    setRenaming(layout);
  }

  function rename(name: string) {
    if (!renaming) return;
    saveLayout({ ...renaming, name });
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
    const index = sorted.findIndex((layout) => layout.id === deleting.id);
    const next = sorted[index + 1] ?? sorted[index - 1];
    deleteLayout(deleting.id);
    announce(`Deleted ${deleting.name}.`);
    // Focus moves to the next row, else the one before, else New layout.
    afterDelete.current = { id: next?.id ?? NEW_LAYOUT, action: 'rename' };
  }

  function openCanvas(layout: LayoutItem) {
    setEditingId(layout.id);
    announce(`Editing ${layout.name}.`);
  }

  function closeCanvas() {
    if (editing) pendingFocus.current = { id: editing.id, action: 'edit' };
    setEditingId(undefined);
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
        // Esc on the canvas goes back to the list, not the table.
        if (event.target !== event.currentTarget || !editing) return;
        event.preventDefault();
        closeCanvas();
      }}
    >
      <header className="layout-editor__header">
        <button type="button" className="button layout-editor__back" onClick={() => dialogRef.current?.close()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
          Back to table
        </button>
        <h2 id={titleId} className="layout-editor__title">
          Card layouts
        </h2>
        {!editing && (
          <button ref={newRef} type="button" className="button button--primary layout-editor__new" onClick={create}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New layout
          </button>
        )}
      </header>

      {editing ? (
        <LayoutCanvas
          key={editing.id}
          layout={editing}
          onChange={saveLayout}
          onBack={closeCanvas}
          announce={announce}
          columns={columns}
          previewSets={previewSets}
          preview={preview}
          onPreview={setPreview}
          snap={snap}
          onSnap={setSnap}
        />
      ) : (
        <div className="layout-editor__body">
          <ul className="layout-list" aria-labelledby={titleId}>
            <Row id={BUILT_IN} layout={DEFAULT_LAYOUT} meta={`Built in · ${describe(DEFAULT_LAYOUT)}`} onDuplicate={() => duplicate(DEFAULT_LAYOUT)} />
            {sorted.map((layout) => (
              <Row
                key={layout.id}
                id={layout.id}
                layout={layout}
                meta={describe(layout)}
                onEdit={() => openCanvas(layout)}
                onRename={(event) => openRename(event, layout)}
                onDuplicate={() => duplicate(layout)}
                onDelete={() => setDeleting(layout)}
              />
            ))}
          </ul>
          <LayoutChoices layouts={sorted} types={types} announce={announce} />
        </div>
      )}

      <div role="status" aria-live="polite" className="visually-hidden">
        <span key={announcement.id}>{announcement.text}</span>
      </div>

      <LayoutNameDialog
        key={renaming?.id}
        layout={renaming}
        validateName={(name, exceptId) => validateLayoutName(layouts, name, exceptId)}
        onConfirm={rename}
        onClose={closeRename}
      />
      <DeleteLayoutDialog layout={deleting} onConfirm={remove} onClose={closeDelete} />
    </dialog>
  );
}

interface RowProps {
  id: string;
  layout: LayoutDesign;
  meta: string;
  onEdit?: () => void;
  onRename?: (event: MouseEvent) => void;
  onDuplicate: () => void;
  onDelete?: () => void;
}

function Row({ id, layout, meta, onEdit, onRename, onDuplicate, onDelete }: RowProps) {
  return (
    <li className="layout-list__row" data-layout-id={id}>
      <div className="layout-list__thumb" aria-hidden="true">
        <CardFace face={SAMPLE_FACE} layout={layout} width={48} />
      </div>
      <div className="layout-list__text">
        <span className="layout-list__name">{layout.name}</span>
        <span className="layout-list__meta">{meta}</span>
      </div>
      <div className="layout-list__actions">
        {onEdit && (
          <button type="button" className="button" data-action="edit" aria-label={`Edit ${layout.name}`} onClick={onEdit}>
            Edit
          </button>
        )}
        {onRename && (
          <button type="button" className="button" data-action="rename" aria-label={`Rename ${layout.name}`} onClick={onRename}>
            Rename
          </button>
        )}
        <button type="button" className="button" data-action="duplicate" aria-label={`Duplicate ${layout.name}`} onClick={onDuplicate}>
          Duplicate
        </button>
        {onDelete && (
          <button type="button" className="button" data-action="delete" aria-label={`Delete ${layout.name}`} onClick={onDelete}>
            Delete
          </button>
        )}
      </div>
    </li>
  );
}
