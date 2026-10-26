import { useId, useState } from 'react';
import type { Pile } from '../model/game';
import { Dialog } from './Dialog';
import './PileCountDialog.css';

export type CountRequest = { mode: 'draw'; pile: Pile; handName: string } | { mode: 'mill'; pile: Pile; targets: Pile[] };

interface PileCountDialogProps {
  /** Give each request its own `key`, so every opening starts with fresh values. */
  request: CountRequest | undefined;
  onConfirm: (count: number, toPileId?: string) => void;
  onClose: () => void;
}

function cardsWord(count: number): string {
  return `${count} ${count === 1 ? 'card' : 'cards'}`;
}

/** SP-6: Draw N to the active hand, or Mill N onto another pile. */
export function PileCountDialog({ request, onConfirm, onClose }: PileCountDialogProps) {
  const countId = useId();
  const errorId = useId();
  const [value, setValue] = useState('1');
  const [target, setTarget] = useState(request?.mode === 'mill' ? request.targets[0]?.id : undefined);
  const [showError, setShowError] = useState(false);

  const max = request?.pile.cardIds.length ?? 0;
  const count = Number(value);
  const valid = /^\d+$/.test(value.trim()) && count >= 1 && count <= max;
  const error = valid ? undefined : `Enter a whole number from 1 to ${max}.`;
  const isDraw = request?.mode === 'draw';

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
      title={request ? `${isDraw ? 'Draw from' : 'Mill from'} ${request.pile.name}` : ''}
      eyebrow={request && `${cardsWord(max)} in the pile`}
      hint={isDraw ? 'Enter draw · Esc cancel' : 'Enter move · Esc cancel'}
      primaryLabel={isDraw ? 'Draw' : 'Move'}
      cancelLabel="Cancel"
      width="narrow"
      onClose={onClose}
      onSubmit={submit}
    >
      {request && (
        <>
          <div className="count-form__field">
            <label htmlFor={countId} className="count-form__label">
              {request.mode === 'draw' ? `Cards to draw into ${request.handName}'s hand` : 'Cards to move'}
            </label>
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
              className="count-form__input"
              data-autofocus
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => setValue(event.currentTarget.value)}
              onBlur={() => setShowError(true)}
            />
            {showError && error && (
              <p id={errorId} className="count-form__error">
                {error}
              </p>
            )}
          </div>

          {request.mode === 'mill' && (
            <fieldset className="count-form__targets">
              <legend className="count-form__label">Move them to the top of</legend>
              {request.targets.map((pile) => (
                <label key={pile.id} className="count-form__target">
                  <input type="radio" name="target" value={pile.id} checked={target === pile.id} onChange={() => setTarget(pile.id)} />
                  <span className="count-form__target-name">{pile.name}</span>{' '}
                  <span className="count-form__target-meta">{cardsWord(pile.cardIds.length)}</span>
                </label>
              ))}
            </fieldset>
          )}
        </>
      )}
    </Dialog>
  );
}
