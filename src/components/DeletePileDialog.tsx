import { useState } from 'react';
import type { Pile } from '../model/game';
import { Dialog } from './Dialog';
import './Form.css';

export interface DeletePileRequest {
  mode?: 'delete';
  pile: Pile;
  /** Piles that can take this pile's cards. */
  targets: Pile[];
}

/** TT-4: a pile dropped on another pile. One of the two is deleted and the other takes its cards. */
export interface MergePilesRequest {
  mode: 'merge';
  /** The pile that was dragged or placed. It's the one deleted unless the user picks the other. */
  pile: Pile;
  /** The pile it was dropped on. */
  other: Pile;
}

export interface MergeChoice {
  fromPileId: string;
  intoPileId: string;
  end: 'top' | 'bottom';
}

interface DeletePileDialogProps {
  /** Give each request its own `key`, so every opening starts with fresh values. */
  request: DeletePileRequest | MergePilesRequest | undefined;
  onConfirm: (moveCardsToPileId: string | undefined) => void;
  onMerge?: (choice: MergeChoice) => void;
  onClose: () => void;
}

function cardsWord(count: number): string {
  return `${count} ${count === 1 ? 'card' : 'cards'}`;
}

/** SP-4: confirm deleting a pile, and choose where its cards go. Merging two piles uses the same dialog. */
export function DeletePileDialog({ request, onConfirm, onMerge, onClose }: DeletePileDialogProps) {
  if (request?.mode === 'merge') return <MergeForm request={request} onMerge={onMerge} onClose={onClose} />;
  return <DeleteForm request={request} onConfirm={onConfirm} onClose={onClose} />;
}

function DeleteForm({ request, onConfirm, onClose }: Pick<DeletePileDialogProps, 'onConfirm' | 'onClose'> & { request: DeletePileRequest | undefined }) {
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

function MergeForm({ request, onMerge, onClose }: Pick<DeletePileDialogProps, 'onMerge' | 'onClose'> & { request: MergePilesRequest }) {
  const [deletedId, setDeletedId] = useState(request.pile.id);
  const [end, setEnd] = useState<'top' | 'bottom'>('top');
  const [deleted, kept] = deletedId === request.pile.id ? [request.pile, request.other] : [request.other, request.pile];

  function submit(): boolean {
    onMerge?.({ fromPileId: deleted.id, intoPileId: kept.id, end });
    return true;
  }

  return (
    <Dialog
      open
      title={`Merge ${request.pile.name} and ${request.other.name}?`}
      hint="Enter merge · Esc cancel"
      primaryLabel="Merge piles"
      cancelLabel="Cancel"
      width="narrow"
      onClose={onClose}
      onSubmit={submit}
    >
      <p className="form-text">
        {deleted.name} will be deleted, and its {cardsWord(deleted.cardIds.length)} will go to the {end} of {kept.name}.
      </p>
      <fieldset className="form-choices">
        <legend className="form-label">Delete which pile</legend>
        {[request.pile, request.other].map((pile, index) => (
          <label key={pile.id} className="form-choice">
            <input
              type="radio"
              name="deleted"
              value={pile.id}
              checked={deletedId === pile.id}
              onChange={() => setDeletedId(pile.id)}
              {...(index === 0 ? { 'data-autofocus': true } : {})}
            />
            <span className="form-choice__name">{pile.name}</span>{' '}
            <span className="form-choice__meta">{cardsWord(pile.cardIds.length)}</span>
          </label>
        ))}
      </fieldset>
      <fieldset className="form-choices">
        <legend className="form-label">Put its cards on {kept.name}</legend>
        {(['top', 'bottom'] as const).map((value) => (
          <label key={value} className="form-choice">
            <input type="radio" name="end" value={value} checked={end === value} onChange={() => setEnd(value)} />
            <span className="form-choice__name">{value === 'top' ? 'Top' : 'Bottom'}</span>
          </label>
        ))}
      </fieldset>
    </Dialog>
  );
}
