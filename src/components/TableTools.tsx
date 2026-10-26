import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import './TableTools.css';

const ICONS = {
  undo: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  redo: 'M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
};

/**
 * The header's table tools, from the Main board. Only undo and redo so far (TT-15);
 * zoom, fit and snap join in 3c.
 */
export function TableTools() {
  const canUndo = useGameStore((s) => s.past.length > 0);
  const canRedo = useGameStore((s) => s.future.length > 0);
  const undo = useGameStore((s) => s.undo);
  const redo = useGameStore((s) => s.redo);

  // Ctrl/⌘+Z undoes; Ctrl/⌘+Shift+Z and Ctrl+Y redo. Fields keep their own undo, and
  // nothing changes under an open dialog or menu, whose contents would go stale.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      const isUndo = key === 'z' && !event.shiftKey;
      const isRedo = (key === 'z' && event.shiftKey) || (key === 'y' && event.ctrlKey && !event.shiftKey);
      if (!isUndo && !isRedo) return;
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable]')) return;
      // Read what's open from the page, not React state, which can lag a dialog closing.
      if (document.querySelector('dialog[open], [role="menu"]')) return;
      event.preventDefault();
      if (isUndo) undo();
      else redo();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);

  const undoLabel = canUndo ? 'Undo (Ctrl+Z)' : 'Undo (Ctrl+Z), nothing to undo';
  const redoLabel = canRedo ? 'Redo (Ctrl+Shift+Z)' : 'Redo (Ctrl+Shift+Z), nothing to redo';

  return (
    <nav className="table-tools" aria-label="Table tools">
      {/* aria-disabled, not disabled, so focus stays put after the last undo and a press says why. */}
      <button type="button" className="table-tools__button" aria-label={undoLabel} title={undoLabel} aria-disabled={!canUndo || undefined} onClick={undo}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={ICONS.undo} />
        </svg>
      </button>
      <button type="button" className="table-tools__button" aria-label={redoLabel} title={redoLabel} aria-disabled={!canRedo || undefined} onClick={redo}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={ICONS.redo} />
        </svg>
      </button>
    </nav>
  );
}
