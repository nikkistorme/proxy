import { useId, useState } from 'react';
import type { Pile } from '../model/session';
import { Dialog } from './Dialog';
import './Form.css';
import { FieldControl, FieldError } from './FieldError';

export type CountRequest =
  | { mode: 'draw'; pile: Pile; handName: string }
  | { mode: 'mill'; pile: Pile; targets: Pile[] }
  | { mode: 'peek'; pile: Pile };

/** Peek starts at 3, like "Look at the top 3", or the whole pile if it's smaller. */
const PEEK_START = 3;

const TEXT = {
  draw: { title: 'Draw from', hint: 'Enter draw · Esc cancel', primary: 'Draw' },
  mill: { title: 'Mill from', hint: 'Enter move · Esc cancel', primary: 'Move' },
  peek: { title: 'Peek at', hint: 'Enter peek · Esc cancel', primary: 'Peek' },
};

interface PileCountDialogProps {
  /** Give each request its own `key`, so every opening starts with fresh values. */
  request: CountRequest | undefined;
  onConfirm: (count: number, toPileId?: string) => void;
  onClose: () => void;
}

function cardsWord(count: number): string {
  return `${count} ${count === 1 ? 'card' : 'cards'}`;
}

/** SP-6: Draw N to the active hand, or Mill N onto another pile. SP-9: Peek at the top N. */
export function PileCountDialog({ request, onConfirm, onClose }: PileCountDialogProps) {
  const countId = useId();
  const errorId = useId();
  const [value, setValue] = useState(() =>
    String(request?.mode === 'peek' ? Math.min(PEEK_START, request.pile.cardIds.length) : 1),
  );
  const [target, setTarget] = useState(request?.mode === 'mill' ? request.targets[0]?.id : undefined);
  const [showError, setShowError] = useState(false);

  const max = request?.pile.cardIds.length ?? 0;
  const count = Number(value);
  const valid = /^\d+$/.test(value.trim()) && count >= 1 && count <= max;
  const error = valid ? undefined : `Enter a whole number from 1 to ${max}.`;
  const text = TEXT[request?.mode ?? 'draw'];

  function submit(): boolean {
    if (!valid || (request?.mode === 'mill' && !target)) {
      setShowError(true);
      return false;
    }
    onConfirm(count, target);
    return true;
  }

  return (
    <Dialog
      open={request !== undefined}
      title={request ? `${text.title} ${request.pile.name}` : ''}
      eyebrow={request && `${cardsWord(max)} in the pile`}
      hint={text.hint}
      primaryLabel={text.primary}
      cancelLabel="Cancel"
      width="narrow"
      onClose={onClose}
      onSubmit={submit}
    >
      {request && (
        <>
          <div className="form-field">
            <label htmlFor={countId} className="form-label">
              {request.mode === 'draw'
                ? `Cards to draw into ${request.handName}'s hand`
                : request.mode === 'peek'
                  ? 'Cards to look at'
                  : 'Cards to move'}
            </label>
            <FieldControl invalid={showError && !valid} className="form-control--number">
              <input
                id={countId}
                type="number"
                inputMode="numeric"
                min={1}
                max={max}
                required
                value={value}
                aria-invalid={showError && !valid}
                aria-describedby={showError && error ? errorId : undefined}
                className="form-input form-input--number"
                data-autofocus
                onFocus={(event) => event.currentTarget.select()}
                onChange={(event) => setValue(event.currentTarget.value)}
                onBlur={() => setShowError(true)}
              />
            </FieldControl>
            {showError && error && <FieldError id={errorId}>{error}</FieldError>}
          </div>

          {request.mode === 'mill' && (
            <fieldset className="form-choices">
              <legend className="form-label">Move them to the top of</legend>
              {request.targets.map((pile) => (
                <label key={pile.id} className="form-choice">
                  <input type="radio" name="target" value={pile.id} checked={target === pile.id} onChange={() => setTarget(pile.id)} />
                  <span className="form-choice__name">{pile.name}</span>{' '}
                  <span className="form-choice__meta">{cardsWord(pile.cardIds.length)}</span>
                </label>
              ))}
            </fieldset>
          )}
        </>
      )}
    </Dialog>
  );
}
