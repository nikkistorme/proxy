import type { Format } from '../model/format';
import { MAX_COUNTERS, parseCounterValue, renameCounter, setCounterValue, validateCounterName, validateCounterValue } from '../model/formatEdit';
import { NameField } from './NameField';

interface CounterRowsProps {
  format: Format;
  seatIndex: number;
  onChange: (format: Format) => void;
  onAdd: () => void;
  onRemove: (counterId: string) => void;
}

/** FS-4: one seat's counters, each with a name, a starting value and Remove, then Add counter (or a note once the seat is full). */
export function CounterRows({ format, seatIndex, onChange, onAdd, onRemove }: CounterRowsProps) {
  const seat = format.seats[seatIndex];
  if (!seat) return null;
  const label = `Seat ${seatIndex + 1}`;
  return (
    <div className="format-editor__counters">
      <h4 className="form-label">Counters</h4>
      {seat.counters.length === 0 && <p className="format-editor__empty">This seat starts with no counters.</p>}
      {seat.counters.map((counter, i) => (
        <div key={counter.id} className="format-editor__counter" data-counter-id={counter.id}>
          <NameField
            label={`${label} counter ${i + 1} name`}
            value={counter.name}
            fieldProps={{ 'data-field': 'name' }}
            validate={(name) => validateCounterName(format, seat.id, counter.id, name)}
            onValid={(name) => onChange(renameCounter(format, seat.id, counter.id, name))}
          />
          <NameField
            label={`${label} counter ${i + 1} starting value`}
            value={String(counter.value)}
            fieldProps={{ inputMode: 'text', 'data-field': 'value' }}
            validate={validateCounterValue}
            onValid={(text) => {
              const value = parseCounterValue(text);
              if (value !== undefined) onChange(setCounterValue(format, seat.id, counter.id, value));
            }}
          />
          <button type="button" className="button" data-field="remove" aria-label={`Remove ${seat.name} ${counter.name}`} onClick={() => onRemove(counter.id)}>
            Remove
          </button>
        </div>
      ))}
      {seat.counters.length >= MAX_COUNTERS ? (
        <p className="format-editor__empty">A seat can have up to {MAX_COUNTERS} counters.</p>
      ) : (
        <button type="button" className="button format-editor__add" data-field="add-counter" aria-label={`Add counter to ${seat.name}`} onClick={onAdd}>
          Add counter
        </button>
      )}
    </div>
  );
}
