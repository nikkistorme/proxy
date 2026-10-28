import { useId, useState } from 'react';
import type { Pile, Seat } from '../model/session';
import { Dialog } from './Dialog';
import './Form.css';
import { FieldControl, FieldError } from './FieldError';

export type PileNameRequest = { mode: 'add'; defaultOwnerId: string | undefined } | { mode: 'rename'; pile: Pile };

interface PileNameDialogProps {
  /** Give each request its own `key`, so every opening starts with fresh values. */
  request: PileNameRequest | undefined;
  seats: Seat[];
  /** Why a name can't be used, or undefined. Shared with the actions (SP-4). */
  validateName: (name: string, exceptPileId?: string) => string | undefined;
  onConfirm: (name: string, ownerSeatId: string | undefined) => void;
  onClose: () => void;
}

const SHARED = '';

/** SP-4: name a new pile and choose its owner, or rename a pile. */
export function PileNameDialog({ request, seats, validateName, onConfirm, onClose }: PileNameDialogProps) {
  const nameId = useId();
  const errorId = useId();
  const isAdd = request?.mode === 'add';
  const [name, setName] = useState(request?.mode === 'rename' ? request.pile.name : '');
  const [owner, setOwner] = useState(request?.mode === 'add' ? (request.defaultOwnerId ?? SHARED) : SHARED);
  const [showError, setShowError] = useState(false);

  const error = validateName(name, request?.mode === 'rename' ? request.pile.id : undefined);

  function submit(): boolean {
    if (error) {
      setShowError(true);
      return false;
    }
    onConfirm(name, owner === SHARED ? undefined : owner);
    return true;
  }

  return (
    <Dialog
      open={request !== undefined}
      title={request?.mode === 'rename' ? `Rename ${request.pile.name}` : 'Add a pile'}
      hint={isAdd ? 'Enter add · Esc cancel' : 'Enter rename · Esc cancel'}
      primaryLabel={isAdd ? 'Add pile' : 'Rename'}
      cancelLabel="Cancel"
      width="narrow"
      onClose={onClose}
      onSubmit={submit}
    >
      {request && (
        <>
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
                data-autofocus
                onFocus={(event) => event.currentTarget.select()}
                onChange={(event) => setName(event.currentTarget.value)}
                onBlur={() => setShowError(name !== '')}
              />
            </FieldControl>
            {showError && error && <FieldError id={errorId}>{error}.</FieldError>}
          </div>

          {isAdd && (
            <fieldset className="form-choices">
              <legend className="form-label">Owner</legend>
              {[...seats.map((seat) => ({ id: seat.id, label: seat.name })), { id: SHARED, label: 'Shared' }].map((choice) => (
                <label key={choice.id || 'shared'} className="form-choice">
                  <input type="radio" name="owner" value={choice.id} checked={owner === choice.id} onChange={() => setOwner(choice.id)} />
                  <span className="form-choice__name">{choice.label}</span>
                </label>
              ))}
            </fieldset>
          )}
        </>
      )}
    </Dialog>
  );
}
