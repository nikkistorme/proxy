import { useEffect, type ReactNode, type Ref } from 'react';
import { zoomPercent } from '../model/tableView';
import { useSessionStore } from '../store/sessionStore';
import { inShortcutScope } from './shortcutScope';
import './TableTools.css';
import { Tooltip } from './Tooltip';

// Icons from the Main board.
const ICONS = {
  undo: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  redo: 'M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
  zoomOut: 'M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14zM20 20l-4-4M8 11h6',
  zoomIn: 'M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14zM20 20l-4-4M8 11h6M11 8v6',
  fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  grid: 'M4 4h16v16H4zM9.3 4v16M14.7 4v16M4 9.3h16M4 14.7h16',
  layout: 'M6 3h12v18H6zM9 6h6v5H9zM9 14h6M9 17h4',
  help: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM9.5 9.5a2.5 2.5 0 0 1 4.9.7c0 1.7-2.4 2.3-2.4 3.8M12 17h.01',
};

interface ToolProps {
  label: string;
  onClick: () => void;
  unavailable?: boolean;
  pressed?: boolean;
  children: ReactNode;
  className?: string;
}

function Tool({ label, onClick, unavailable, pressed, children, className = 'table-tools__button' }: ToolProps) {
  return (
    <Tooltip label={label} align="end">
      {/* aria-disabled, not disabled, so focus stays put and a press says why. */}
      <button type="button" className={className} aria-label={label} aria-disabled={unavailable || undefined} aria-pressed={pressed} onClick={onClick}>
        {children}
      </button>
    </Tooltip>
  );
}

function Icon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

interface TableToolsProps {
  /** SP-4: adds a pile to the table. Left out, there's no Add pile button. */
  onAddPile?: () => void;
  addPileRef?: Ref<HTMLButtonElement>;
  /** A11Y-4: opens the shortcut reference. Left out, there's no Keyboard shortcuts button. */
  onShortcuts?: () => void;
  /** LY-1: opens the layout screen. Left out, there's no Card layouts button. */
  onLayouts?: () => void;
}

/**
 * The header's table tools, from the Main board: undo and redo (TT-15), zoom and
 * fit all (TT-1), grid snap (TT-2), and Add pile (SP-4), which puts a pile on the table.
 */
export function TableTools({ onAddPile, addPileRef, onShortcuts, onLayouts }: TableToolsProps = {}) {
  const canUndo = useSessionStore((s) => s.past.length > 0);
  const canRedo = useSessionStore((s) => s.future.length > 0);
  const undo = useSessionStore((s) => s.undo);
  const redo = useSessionStore((s) => s.redo);
  const { zoom, snap } = useSessionStore((s) => s.view);
  const setView = useSessionStore((s) => s.setView);
  const announce = useSessionStore((s) => s.announce);
  const viewport = useSessionStore((s) => s.tableViewport);

  const toggleSnap = () => {
    setView({ snap: !snap });
    announce(`Snap to grid ${snap ? 'off' : 'on'}.`);
  };

  // Ctrl/⌘+Z undoes; Ctrl/⌘+Shift+Z and Ctrl+Y redo. + or =, −, 0 and G zoom, fit and
  // snap, while focus is in the table, the hand or these tools (WCAG 2.1.4). Fields
  // keep their own keys, and nothing changes under an open dialog or menu, whose
  // contents would go stale.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey) return;
      const key = event.key.toLowerCase();
      const command = event.ctrlKey || event.metaKey;
      const isUndo = command && key === 'z' && !event.shiftKey;
      const isRedo = command && ((key === 'z' && event.shiftKey) || (key === 'y' && event.ctrlKey && !event.shiftKey));
      // Browser zoom keeps Ctrl/⌘ with + and −.
      const viewKey = command ? undefined : ({ '+': 'in', '=': 'in', '-': 'out', '0': 'fit', g: 'snap' } as const)[key];
      if (!isUndo && !isRedo && !viewKey) return;
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable]')) return;
      if (viewKey && !inShortcutScope(target)) return;
      // Read what's open from the page, not React state, which can lag a dialog closing.
      if (document.querySelector('dialog[open], [role="menu"]')) return;
      event.preventDefault();
      if (isUndo) undo();
      else if (isRedo) redo();
      else if (viewKey === 'in' || viewKey === 'out') viewport?.stepZoom(viewKey);
      else if (viewKey === 'fit') viewport?.fitAll();
      else if (viewKey === 'snap') toggleSnap();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  });

  const undoLabel = canUndo ? 'Undo (Ctrl+Z)' : 'Undo (Ctrl+Z), nothing to undo';
  const redoLabel = canRedo ? 'Redo (Ctrl+Shift+Z)' : 'Redo (Ctrl+Shift+Z), nothing to redo';

  return (
    <nav className="table-tools" aria-label="Table tools">
      <Tool label={undoLabel} unavailable={!canUndo} onClick={undo}>
        <Icon d={ICONS.undo} />
      </Tool>
      <Tool label={redoLabel} unavailable={!canRedo} onClick={redo}>
        <Icon d={ICONS.redo} />
      </Tool>
      <span className="table-tools__separator" aria-hidden="true" />
      <Tool label="Zoom out (−)" onClick={() => viewport?.stepZoom('out')}>
        <Icon d={ICONS.zoomOut} />
      </Tool>
      <Tool label={`Zoom ${zoomPercent(zoom)}, reset`} className="table-tools__button table-tools__zoom" onClick={() => viewport?.resetZoom()}>
        {zoomPercent(zoom)}
      </Tool>
      <Tool label="Zoom in (+)" onClick={() => viewport?.stepZoom('in')}>
        <Icon d={ICONS.zoomIn} />
      </Tool>
      <Tool label="Fit all cards (0)" onClick={() => viewport?.fitAll()}>
        <Icon d={ICONS.fit} />
      </Tool>
      <Tool label="Snap to grid (G)" pressed={snap} onClick={toggleSnap}>
        <Icon d={ICONS.grid} />
      </Tool>
      {onAddPile && (
        // A visible label, not an icon alone: it's the only way to make a pile.
        <button ref={addPileRef} type="button" className="table-tools__button table-tools__add" onClick={onAddPile}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add pile
        </button>
      )}
      {onLayouts && (
        <Tool label="Card layouts (L)" onClick={onLayouts}>
          <Icon d={ICONS.layout} />
        </Tool>
      )}
      {onShortcuts && (
        <Tool label="Keyboard shortcuts (?)" onClick={onShortcuts}>
          <Icon d={ICONS.help} />
        </Tool>
      )}
    </nav>
  );
}
