import { useCallback, useRef, useState } from 'react';
import { Menu } from './Menu';
import { SessionLog } from './SessionLog';
import './SessionMenu.css';

const LOG_ICON = 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01';

/**
 * The session's own menu in the header. It says "This session" until sessions
 * have names. For now it opens the session log (TT-14).
 */
export function SessionMenu() {
  const [menuOpen, setMenuOpen] = useState(false);
  /** When the log opened, or undefined while it's closed. */
  const [logOpenedAt, setLogOpenedAt] = useState<number>();
  const buttonRef = useRef<HTMLButtonElement>(null);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    buttonRef.current?.focus();
  }, []);

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
          entries={[{ kind: 'item', id: 'log', label: 'Session log', icon: LOG_ICON, onSelect: () => setLogOpenedAt(Date.now()) }]}
          onClose={closeMenu}
        />
      )}
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
