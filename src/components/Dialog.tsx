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
  /** What the cancel button does instead of closing, like a confirm step's Back. */
  onCancel?: () => void;
  /** Makes the dialog a form: Enter or the main button submits. Return true to close. */
  onSubmit?: () => boolean;
  /**
   * For long read-only content with nothing focusable inside: names the body and
   * makes it the first tab stop, so arrow keys can scroll it in every browser.
   */
  bodyLabel?: string;
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
  onCancel,
  onSubmit,
  bodyLabel,
  width = 'wide',
  children,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const reported = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      reported.current = false;
      dialog.showModal();
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  /** Tells the parent once per opening, from whichever comes first: our own close or the close event. */
  function reportClosed() {
    if (reported.current) return;
    reported.current = true;
    onClose();
  }

  // The close event is a task queued after the click or key, and a key pressed in between
  // would miss its shortcut scope, so a close we cause reports at once instead of waiting for it.
  const close = () => {
    dialogRef.current?.close();
    reportClosed();
  };

  function submit(event: FormEvent) {
    event.preventDefault();
    if (onSubmit?.()) close();
  }

  const content = (
    <>
      {bodyLabel ? (
        // A scrollable region needs a tab stop to scroll by keyboard in Safari (WCAG 2.1.1).
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        <div className="dialog__body" role="region" aria-label={bodyLabel} tabIndex={0} data-autofocus>
          {children}
        </div>
      ) : (
        <div className="dialog__body">{children}</div>
      )}
      <div className="dialog__footer">
        {hint && (
          <span className="dialog__hint" aria-hidden="true">
            {hint}
          </span>
        )}
        <div className="dialog__actions">
          {cancelLabel && (
            <button type="button" className="button" onClick={onCancel ?? close}>
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
    <dialog
      ref={dialogRef}
      className={`dialog dialog--${width}`}
      aria-labelledby={titleId}
      // React passes a nested dialog's close event up to this one too; only act on our own.
      onClose={(event) => event.target === event.currentTarget && reportClosed()}
    >
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
