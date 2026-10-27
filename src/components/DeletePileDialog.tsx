import { useState } from 'react';
import type { Pile } from '../model/game';
import { Dialog } from './Dialog';
import './Form.css';

export interface DeletePileRequest {
  pile: Pile;
  /** Piles that can take this pile's cards. */
  targets: Pile[];
}

interface DeletePileDialogProps {
  /** Give each request its own `key`, so every opening starts with fresh values. */
  request: DeletePileRequest | undefined;
  onConfirm: (moveCardsToPileId: string | undefined) => void;
  onClose: () => void;
}

function cardsWord(count: number): string {
  return `${count} ${count === 1 ? 'card' : 'cards'}`;
}

/** SP-4: confirm deleting a pile, and choose where its cards go. */
export function DeletePileDialog({ request, onConfirm, onClose }: DeletePileDialogProps) {
  const [target, setTarget] = useState(request?.targets[0]?.id);
  const count = request?.pile.cardIds.length ?? 0;

  function submit(): boolean {
    if (count > 0 && !target) return false;
    onConfirm(count > 0 ? target : undefined);
    return true;
  }

  return (
    <Dialog
      open={request !== undefined}
      title={request ? `Delete ${request.pile.name}?` : ''}
      hint="Enter delete · Esc cancel"
      primaryLabel="Delete pile"
      cancelLabel="Cancel"
      width="narrow"
      onClose={onClose}
      onSubmit={submit}
    >
      {request &&
        (count === 0 ? (
          <p className="form-text">This pile is empty.</p>
        ) : (
          <>
            <p className="form-text">
              It has {cardsWord(count)}. They'll go to the bottom of the pile you choose.
            </p>
            <fieldset className="form-choices">
              <legend className="form-label">Move its cards to</legend>
              {request.targets.map((pile, index) => (
                <label key={pile.id} className="form-choice">
                  <input
                    type="radio"
                    name="target"
                    value={pile.id}
                    checked={target === pile.id}
                    onChange={() => setTarget(pile.id)}
                    {...(index === 0 ? { 'data-autofocus': true } : {})}
                  />
                  <span className="form-choice__name">{pile.name}</span>{' '}
                  <span className="form-choice__meta">{cardsWord(pile.cardIds.length)}</span>
                </label>
              ))}
            </fieldset>
          </>
        ))}
    </Dialog>
  );
}
