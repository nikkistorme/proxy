import { useEffect, useId, useRef, type FormEvent, type ReactNode } from 'react';
import './Dialog.css';

interface DialogProps {
  open: boolean;
  title: string;
  /** Small context line above the title, like the file or pile it is about. */
  eyebrow?: ReactNode;
  /** Decorative picture before the title, like the card being moved. */
  media?: ReactNode;
  /** Keyboard hint in the footer, like "Enter draw · Esc cancel". */
  hint?: string;
  /** Called once whenever the dialog closes: Esc, the close button, or an action. */
  onClose: () => void;
  /** Main footer button. Without `onSubmit` it just closes the dialog, like "Done". */
  primaryLabel: string;
  /** Adds a Cancel button that closes without submitting. */
  cancelLabel?: string;
  /** Makes the dialog a form: Enter or the main button submits. Return true to close. */
  onSubmit?: () => boolean;
  /** `narrow` for short forms; `medium` for pickers; `wide` for tables. */
  width?: 'narrow' | 'medium' | 'wide';
  children: ReactNode;
}

/**
 * A modal dialog following the MoveDialog board, on the native <dialog>: focus
 * moves in and stays there, Escape closes it. Put `data-autofocus` on the
 * element that should get focus first; otherwise the close button gets it.
 */
export function Dialog({
  open,
  title,
  eyebrow,
  media,
  hint,
  onClose,
  primaryLabel,
  cancelLabel,
  onSubmit,
  width = 'wide',
  children,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const close = () => dialogRef.current?.close();

  function submit(event: FormEvent) {
    event.preventDefault();
    if (onSubmit?.()) close();
  }

  const content = (
    <>
      <div className="dialog__body">{children}</div>
      <div className="dialog__footer">
        {hint && (
          <span className="dialog__hint" aria-hidden="true">
            {hint}
          </span>
        )}
        <div className="dialog__actions">
          {cancelLabel && (
            <button type="button" className="button" onClick={close}>
              {cancelLabel}
            </button>
          )}
          {onSubmit ? (
            <button type="submit" className="button button--primary">
              {primaryLabel}
            </button>
          ) : (
            <button type="button" className="button button--primary" onClick={close}>
              {primaryLabel}
            </button>
          )}
        </div>
      </div>
    </>
  );

  return (
    // Esc fires the dialog's close event, which reports back through onClose.
    <dialog ref={dialogRef} className={`dialog dialog--${width}`} aria-labelledby={titleId} onClose={onClose}>
      {open && (
        <>
          <div className="dialog__header">
            {media && (
              <div className="dialog__media" aria-hidden="true">
                {media}
              </div>
            )}
            <div className="dialog__titles">
              {eyebrow && <span className="dialog__eyebrow">{eyebrow}</span>}
              <h2 id={titleId} className="dialog__title">
                {title}
              </h2>
            </div>
            <button type="button" className="icon-button" aria-label="Close" onClick={close}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          {onSubmit ? (
            <form className="dialog__form" onSubmit={submit} noValidate>
              {content}
            </form>
          ) : (
            content
          )}
        </>
      )}
    </dialog>
  );
}
