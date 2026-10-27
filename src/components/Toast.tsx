import { useSessionStore } from '../store/sessionStore';
import './Toast.css';

/** The id of the toast's Undo button, for moving focus there when nothing else is left to focus. */
export const TOAST_UNDO_ID = 'toast-undo';

/**
 * The brief's "toast with Undo" after a destructive action, instead of asking
 * first. The live region already reads the action out, so the toast is only
 * seen. It has no time limit (WCAG 2.2.1): it goes with the next action.
 */
export function Toast() {
  const toast = useSessionStore((s) => s.toast);
  const undo = useSessionStore((s) => s.undo);
  const dismiss = useSessionStore((s) => s.dismissToast);
  if (!toast) return null;
  return (
    <div className="toast" key={toast.id}>
      <span className="toast__text">{toast.text}</span>
      <button id={TOAST_UNDO_ID} type="button" className="toast__undo" onClick={undo}>
        Undo
      </button>
      <button type="button" className="toast__close" aria-label="Dismiss" onClick={dismiss}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}
