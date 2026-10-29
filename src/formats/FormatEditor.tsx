import { useEffect, useId, useRef, useState } from 'react';
import { FieldControl, FieldError } from '../components/FieldError';
import { touchScreen } from '../components/touchScreen';
import '../components/Form.css';
import type { FormatItem } from '../model/format';
import { addPile, removePile, renamePile, renameSeat, setPileOwner, setUsesDice, validatePileName, validateSeatName } from '../model/formatEdit';
import './FormatEditor.css';

const SHARED = '';

interface FormatEditorProps {
  format: FormatItem;
  /** Saves a valid change straight away (PS-1). */
  onChange: (format: FormatItem) => void;
  announce: (text: string) => void;
}

/** What to focus once the editor has rendered: a pile's name field or Remove button, or Add pile. */
type Focus = { kind: 'name' | 'remove'; pileId: string } | { kind: 'add' };

/**
 * FS-2: edit a saved format's seats and piles. Every valid change saves at
 * once; an invalid field shows its error and keeps the last valid value. Seats
 * can be renamed but not added or removed.
 */
export function FormatEditor({ format, onChange, announce }: FormatEditorProps) {
  const root = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const pending = useRef<Focus>(undefined);
  const diceId = useId();

  // Runs after every render, so it finds fields that have just appeared.
  useEffect(() => {
    const focus = pending.current;
    if (!focus) return;
    pending.current = undefined;
    if (focus.kind === 'add') addRef.current?.focus();
    else root.current?.querySelector<HTMLElement>(`[data-pile-id="${focus.pileId}"] [data-field="${focus.kind}"]`)?.focus();
  });

  function add() {
    const { format: next, pile } = addPile(format);
    onChange(next);
    announce(`Added pile ${pile.name}.`);
    // Not on a touch screen: a focused text field slides the keyboard up.
    if (!touchScreen()) pending.current = { kind: 'name', pileId: pile.id };
  }

  function remove(pileId: string) {
    const index = format.piles.findIndex((pile) => pile.id === pileId);
    const gone = format.piles[index];
    if (!gone) return;
    const neighbour = format.piles[index + 1] ?? format.piles[index - 1];
    onChange(removePile(format, pileId));
    announce(`Removed ${gone.name}.`);
    pending.current = neighbour ? { kind: 'remove', pileId: neighbour.id } : { kind: 'add' };
  }

  function setOwner(pileId: string, ownerId: string) {
    const pile = format.piles.find((p) => p.id === pileId);
    if (!pile) return;
    const owner = format.seats.find((seat) => seat.id === ownerId);
    onChange(setPileOwner(format, pileId, owner?.id));
    announce(`${pile.name} is now ${owner ? `owned by ${owner.name}` : 'shared'}.`);
  }

  function toggleDice(on: boolean) {
    onChange(setUsesDice(format, on));
    announce(on ? 'Dice turned on.' : 'Dice turned off.');
  }

  return (
    <div ref={root} className="format-editor">
      <h3 className="format-editor__heading">{format.name}</h3>

      <fieldset className="format-editor__section">
        <legend className="form-label">Seats</legend>
        {format.seats.map((seat, i) => (
          <NameField
            key={seat.id}
            label={`Seat ${i + 1} name`}
            value={seat.name}
            validate={(name) => validateSeatName(format, seat.id, name)}
            onValid={(name) => onChange(renameSeat(format, seat.id, name))}
          />
        ))}
      </fieldset>

      <section className="format-editor__section" aria-labelledby={`${diceId}-piles`}>
        <h3 id={`${diceId}-piles`} className="form-label">
          Piles
        </h3>
        {format.piles.length === 0 && <p className="format-editor__empty">This format starts with no piles.</p>}
        {format.piles.map((pile, i) => (
          <div key={pile.id} className="format-editor__pile" data-pile-id={pile.id}>
            <NameField
              label={`Pile ${i + 1} name`}
              value={pile.name}
              fieldProps={{ 'data-field': 'name' }}
              validate={(name) => validatePileName(format, pile.id, name)}
              onValid={(name) => onChange(renamePile(format, pile.id, name))}
            />
            <div className="form-field">
              <label className="form-label" htmlFor={`${diceId}-${pile.id}`}>
                {`Pile ${i + 1} owner`}
              </label>
              <select id={`${diceId}-${pile.id}`} className="form-input" value={pile.ownerSeatId ?? SHARED} onChange={(event) => setOwner(pile.id, event.currentTarget.value)}>
                {format.seats.map((seat) => (
                  <option key={seat.id} value={seat.id}>
                    {seat.name}
                  </option>
                ))}
                <option value={SHARED}>Shared</option>
              </select>
            </div>
            <button type="button" className="button" data-field="remove" aria-label={`Remove ${pile.name}`} onClick={() => remove(pile.id)}>
              Remove
            </button>
          </div>
        ))}
        <button ref={addRef} type="button" className="button format-editor__add" onClick={add}>
          Add pile
        </button>
      </section>

      <label className="form-choice">
        <input type="checkbox" checked={format.usesDice} onChange={(event) => toggleDice(event.currentTarget.checked)} />
        <span className="form-choice__name">Uses dice</span>
      </label>
    </div>
  );
}

interface NameFieldProps {
  label: string;
  /** The saved name. The field shows what was typed, even when it isn't valid. */
  value: string;
  validate: (name: string) => string | undefined;
  onValid: (name: string) => void;
  fieldProps?: Record<string, string>;
}

/** A text field that saves each valid value as it is typed and shows the error for an invalid one. */
function NameField({ label, value, validate, onValid, fieldProps }: NameFieldProps) {
  const id = useId();
  const errorId = useId();
  const [draft, setDraft] = useState(value);
  const error = validate(draft);

  function change(next: string) {
    setDraft(next);
    if (validate(next) === undefined && next.trim() !== value) onValid(next);
  }

  return (
    <div className="form-field">
      <label htmlFor={id} className="form-label">
        {label}
      </label>
      <FieldControl invalid={error !== undefined}>
        <input
          id={id}
          type="text"
          autoComplete="off"
          className="form-input"
          value={draft}
          aria-invalid={error !== undefined}
          aria-describedby={error ? errorId : undefined}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => change(event.currentTarget.value)}
          {...fieldProps}
        />
      </FieldControl>
      {error && <FieldError id={errorId}>{error}.</FieldError>}
    </div>
  );
}
