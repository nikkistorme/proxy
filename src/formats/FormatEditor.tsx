import { useEffect, useId, useRef } from 'react';
import { touchScreen } from '../components/touchScreen';
import '../components/Form.css';
import type { FormatItem } from '../model/format';
import { addCounter, addPile, removeCounter, removePile, renamePile, renameSeat, setPileOwner, setUsesDice, validatePileName, validateSeatName } from '../model/formatEdit';
import { CounterRows } from './CounterRows';
import { NameField } from './NameField';
import './FormatEditor.css';

const SHARED = '';

interface FormatEditorProps {
  format: FormatItem;
  /** Saves a valid change straight away (PS-1). */
  onChange: (format: FormatItem) => void;
  announce: (text: string) => void;
}

/** What to focus once the editor has rendered: a pile's name field or Remove button, Add pile, or anything else by selector. */
type Focus = { kind: 'name' | 'remove'; pileId: string } | { kind: 'add' } | { kind: 'selector'; selector: string };

/**
 * FS-2, FS-4: edit a saved format's seats, their counters, and piles. Every valid change saves at
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
    else if (focus.kind === 'selector') root.current?.querySelector<HTMLElement>(focus.selector)?.focus();
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

  function addSeatCounter(seatId: string) {
    const seat = format.seats.find((s) => s.id === seatId);
    const { format: next, counter } = addCounter(format, seatId);
    if (!seat || !counter) return;
    onChange(next);
    announce(`Added counter ${counter.name} to ${seat.name}.`);
    if (!touchScreen()) pending.current = { kind: 'selector', selector: `[data-counter-id="${counter.id}"] [data-field="name"]` };
  }

  function removeSeatCounter(seatId: string, counterId: string) {
    const seat = format.seats.find((s) => s.id === seatId);
    const index = seat?.counters.findIndex((c) => c.id === counterId) ?? -1;
    const gone = seat?.counters[index];
    if (!seat || !gone) return;
    const neighbour = seat.counters[index + 1] ?? seat.counters[index - 1];
    onChange(removeCounter(format, seatId, counterId));
    announce(`Removed ${seat.name} ${gone.name}.`);
    pending.current = {
      kind: 'selector',
      selector: neighbour ? `[data-counter-id="${neighbour.id}"] [data-field="remove"]` : `[data-seat-id="${seatId}"] [data-field="add-counter"]`,
    };
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

      <section className="format-editor__section" aria-labelledby={`${diceId}-seats`}>
        <h3 id={`${diceId}-seats`} className="form-label">
          Seats
        </h3>
        {format.seats.map((seat, i) => (
          <fieldset key={seat.id} className="format-editor__seat" data-seat-id={seat.id}>
            <legend className="format-editor__seat-legend">{`Seat ${i + 1}`}</legend>
            <NameField
              label={`Seat ${i + 1} name`}
              value={seat.name}
              validate={(name) => validateSeatName(format, seat.id, name)}
              onValid={(name) => onChange(renameSeat(format, seat.id, name))}
            />
            <CounterRows format={format} seatIndex={i} onChange={onChange} onAdd={() => addSeatCounter(seat.id)} onRemove={(counterId) => removeSeatCounter(seat.id, counterId)} />
          </fieldset>
        ))}
      </section>

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
