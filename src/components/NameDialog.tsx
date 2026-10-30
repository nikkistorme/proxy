import { useId, useState } from 'react';
import { Dialog } from './Dialog';
import { FieldControl, FieldError } from './FieldError';
import { touchScreen } from './touchScreen';
import './Form.css';

interface NameDialogProps {
  /** The layout or format to rename. Give each opening its own `key`, so it starts with fresh values. */
  item: { id: string; name: string } | undefined;
  /** Why a name can't be used, or undefined. */
  validateName: (name: string, exceptId: string) => string | undefined;
  onConfirm: (name: string) => void;
  onClose: () => void;
  /** Heading, when it isn't "Rename <name>" (PS-3: "Save snapshot"). */
  title?: string;
  /** Main button label; "Rename" by default. */
  primaryLabel?: string;
  /** Footer keyboard hint; "Enter rename · Esc cancel" by default. */
  hint?: string;
}

/** LY-1, FS-2, PS-3: rename a layout, a format or a snapshot, or name a new snapshot. Layout names are unique, so the `layout` column can pick a layout (LY-8). */
export function NameDialog({ item, validateName, onConfirm, onClose, title, primaryLabel = 'Rename', hint = 'Enter rename · Esc cancel' }: NameDialogProps) {
  const nameId = useId();
  const errorId = useId();
  const [name, setName] = useState(item?.name ?? '');
  const [showError, setShowError] = useState(false);
  /** On a touch screen, focus goes to a button, never straight to a text field. */
  const [touch] = useState(touchScreen);

  const error = item ? validateName(name, item.id) : undefined;

  function submit(): boolean {
    if (error) {
      setShowError(true);
      return false;
    }
    onConfirm(name.trim());
    return true;
  }

  return (
    <Dialog
      open={item !== undefined}
      title={item ? (title ?? `Rename ${item.name}`) : ''}
      hint={hint}
      primaryLabel={primaryLabel}
      cancelLabel="Cancel"
      width="narrow"
      onClose={onClose}
      onSubmit={submit}
    >
      {item && (
        <div className="form-field">
          <label htmlFor={nameId} className="form-label">
            Name
          </label>
          <FieldControl invalid={showError && error !== undefined}>
            <input
              id={nameId}
              type="text"
              autoComplete="off"
              required
              value={name}
              aria-invalid={showError && error !== undefined}
              aria-describedby={showError && error ? errorId : undefined}
              className="form-input"
              {...(touch ? {} : { 'data-autofocus': true })}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => setName(event.currentTarget.value)}
              onBlur={() => setShowError(name !== '')}
            />
          </FieldControl>
          {showError && error && <FieldError id={errorId}>{error}.</FieldError>}
        </div>
      )}
    </Dialog>
  );
}
