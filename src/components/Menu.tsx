import { useEffect, useRef, type KeyboardEvent } from 'react';
import './Menu.css';

export type MenuEntry =
  | {
      kind: 'item';
      id: string;
      label: string;
      /** 24 × 24 SVG path for the leading icon. */
      icon?: string;
      shortcut?: string;
      onSelect: () => void;
    }
  | { kind: 'checkbox'; id: string; label: string; checked: boolean; onToggle: () => void }
  | { kind: 'separator'; id: string };

interface MenuProps {
  label: string;
  /** Context line at the top, like "Kindle Ward · Ash · on table". */
  header: string;
  entries: MenuEntry[];
  /** Called when the menu should close; focus goes back to whatever opened it. */
  onClose: () => void;
}

/**
 * An action menu following the ActionMenu board. Arrow keys, Home and End
 * move between items; Enter or Space selects; Escape or Tab closes.
 */
export function Menu({ label, header, entries, onClose }: MenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  const items = () => [...(menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])];

  useEffect(() => {
    items()[0]?.focus();
    // Close on any press outside the menu's container. The container also holds
    // the opener, whose own click toggles the menu, so it is left alone.
    const onPointerDown = (event: PointerEvent) => {
      const container = menuRef.current?.parentElement ?? menuRef.current;
      if (!container?.contains(event.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [onClose]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLElement);
    const focusAt = (i: number) => list[(i + list.length) % list.length]?.focus();
    switch (event.key) {
      case 'ArrowDown':
        focusAt(index + 1);
        break;
      case 'ArrowUp':
        focusAt(index - 1);
        break;
      case 'Home':
        focusAt(0);
        break;
      case 'End':
        focusAt(list.length - 1);
        break;
      case 'Escape':
      case 'Tab':
        onClose();
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  return (
    <div ref={menuRef} role="menu" aria-label={label} tabIndex={-1} className="menu" onKeyDown={onKeyDown}>
      <div className="menu__header" aria-hidden="true">
        {header}
      </div>
      {entries.map((entry) => {
        if (entry.kind === 'separator') return <div key={entry.id} role="separator" className="menu__separator" />;
        if (entry.kind === 'checkbox') {
          return (
            <button
              key={entry.id}
              type="button"
              role="menuitemcheckbox"
              aria-checked={entry.checked}
              tabIndex={-1}
              className="menu__item"
              onClick={entry.onToggle}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="4" y="4" width="16" height="16" rx="3" />
                {entry.checked && <path d="M8 12.5l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />}
              </svg>
              <span className="menu__label">{entry.label}</span>
            </button>
          );
        }
        return (
          <button
            key={entry.id}
            type="button"
            role="menuitem"
            tabIndex={-1}
            className="menu__item"
            aria-keyshortcuts={entry.shortcut}
            onClick={() => {
              entry.onSelect();
              onClose();
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {entry.icon && <path d={entry.icon} />}
            </svg>
            <span className="menu__label">{entry.label}</span>
            {entry.shortcut && (
              <kbd className="menu__kbd" aria-hidden="true">
                {entry.shortcut}
              </kbd>
            )}
          </button>
        );
      })}
      <div className="menu__hint" aria-hidden="true">
        ↑↓ choose · Enter select · Esc close
      </div>
    </div>
  );
}
