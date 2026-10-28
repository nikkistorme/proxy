import { useId, useState } from 'react';
import { Dialog } from '../components/Dialog';
import { touchScreen } from '../components/touchScreen';
import type { LayoutItem } from '../layouts/LayoutsProvider';
import '../components/Form.css';

interface LayoutNameDialogProps {
  /** The layout to rename. Give each opening its own `key`, so it starts with fresh values. */
  layout: LayoutItem | undefined;
  /** Why a name can't be used, or undefined. */
  validateName: (name: string, exceptId: string) => string | undefined;
  onConfirm: (name: string) => void;
  onClose: () => void;
}

/** LY-1: rename a layout. Names are unique, so the `layout` column can pick one (LY-8). */
export function LayoutNameDialog({ layout, validateName, onConfirm, onClose }: LayoutNameDialogProps) {
  const nameId = useId();
  const errorId = useId();
  const [name, setName] = useState(layout?.name ?? '');
  const [showError, setShowError] = useState(false);
  /** On a touch screen, focus goes to a button, never straight to a text field. */
  const [touch] = useState(touchScreen);

  const error = layout ? validateName(name, layout.id) : undefined;

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
      open={layout !== undefined}
      title={layout ? `Rename ${layout.name}` : ''}
      hint="Enter rename · Esc cancel"
      primaryLabel="Rename"
      cancelLabel="Cancel"
      width="narrow"
      onClose={onClose}
      onSubmit={submit}
    >
      {layout && (
        <div className="form-field">
          <label htmlFor={nameId} className="form-label">
            Name
          </label>
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
          {showError && error && (
            <p id={errorId} className="form-error">
              {error}.
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}
