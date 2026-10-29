import { useId, useState } from 'react';
import { FieldControl, FieldError } from '../components/FieldError';
import '../components/Form.css';

interface NameFieldProps {
  label: string;
  /** The saved name. The field shows what was typed, even when it isn't valid. */
  value: string;
  validate: (name: string) => string | undefined;
  onValid: (name: string) => void;
  fieldProps?: Record<string, string>;
}

/** A text field that saves each valid value as it is typed and shows the error for an invalid one. */
export function NameField({ label, value, validate, onValid, fieldProps }: NameFieldProps) {
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
          inputMode="text"
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
