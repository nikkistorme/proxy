import { useId, useState } from 'react';
import { FieldControl, FieldError } from '../components/FieldError';
import '../components/Form.css';
import { PublishHowTo } from '../components/PublishHowTo';
import { classifySheetUrl } from '../csv/sheetUrl';
import './FormatEditor.css';

interface SheetUrlFieldProps {
  label: string;
  /** The saved address, or empty. The field shows what was typed, even when it isn't valid. */
  value: string;
  /** Saves a valid address, or an empty string to clear it. */
  onValid: (url: string) => void;
}

/**
 * CD-12: a pile's optional default sheet URL. Checked like Load from URL (CD-7, CD-8)
 * but never fetched here. A blank field is valid and clears the address; an invalid
 * one shows its error, and an edit link shows the publish steps too, and neither is saved.
 */
export function SheetUrlField({ label, value, onValid }: SheetUrlFieldProps) {
  const id = useId();
  const errorId = useId();
  const [draft, setDraft] = useState(value);
  const checked = draft.trim() === '' ? undefined : classifySheetUrl(draft);
  const problem = checked && checked.kind !== 'ok' ? checked : undefined;

  function change(next: string) {
    setDraft(next);
    const result = next.trim() === '' ? undefined : classifySheetUrl(next);
    if ((result === undefined || result.kind === 'ok') && next.trim() !== value) onValid(next.trim());
  }

  return (
    <div className="form-field">
      <label htmlFor={id} className="form-label">
        {label}
      </label>
      <FieldControl invalid={problem !== undefined}>
        <input
          id={id}
          type="url"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="form-input format-editor__url"
          value={draft}
          placeholder="Optional"
          aria-invalid={problem !== undefined}
          aria-describedby={problem ? errorId : undefined}
          data-field="sheet-url"
          onChange={(event) => change(event.currentTarget.value)}
        />
      </FieldControl>
      {problem && <FieldError id={errorId}>{problem.error}</FieldError>}
      {problem?.kind === 'edit-link' && <PublishHowTo />}
    </div>
  );
}
