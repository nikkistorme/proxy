import { useEffect, useRef, useState, type FocusEvent, type PointerEvent, type ReactNode } from 'react';
import './Tooltip.css';

/** How long the pointer rests on a control before its tooltip shows. */
export const TOOLTIP_DELAY_MS = 300;

interface TooltipProps {
  /** The text shown. The control keeps its own accessible name, so this is hidden from screen readers. */
  label: string;
  /** `end` lines the tooltip up with the control's right edge, for controls at the right of the screen. */
  align?: 'center' | 'end';
  children: ReactNode;
}

/**
 * A visible label for an icon-only control (the Design System's "label and its shortcut
 * in the tooltip"). It shows on mouse hover after a short delay and at once on keyboard
 * focus. Esc hides it, and it stays while the pointer is over it (WCAG 1.4.13).
 */
export function Tooltip({ label, align = 'center', children }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<number>(undefined);

  const clearTimer = () => window.clearTimeout(timerRef.current);
  useEffect(() => clearTimer, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  function onPointerEnter(event: PointerEvent) {
    // Touch has no hover, and a tap shouldn't leave a tooltip behind.
    if (event.pointerType === 'touch') return;
    clearTimer();
    timerRef.current = window.setTimeout(() => setOpen(true), TOOLTIP_DELAY_MS);
  }

  function onPointerLeave() {
    clearTimer();
    setOpen(false);
  }

  function onFocus(event: FocusEvent) {
    if (event.target.matches(':focus-visible')) setOpen(true);
  }

  function onBlur() {
    clearTimer();
    setOpen(false);
  }

  return (
    // The wrapper only hears hover and focus from the control inside it; it isn't a control itself.
    <span className="tooltip" role="presentation" onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave} onFocus={onFocus} onBlur={onBlur}>
      {children}
      {open && (
        <span className={`tooltip__popup tooltip__popup--${align}`} aria-hidden="true">
          <span className="tooltip__text">{label}</span>
        </span>
      )}
    </span>
  );
}
