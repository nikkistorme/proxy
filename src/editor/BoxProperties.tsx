import { useId, useRef, useState } from 'react';
import type { BoxContent, LayoutBox } from '../model/layout';
import { parseColumns, parseHexColor } from '../model/layoutBoxes';
import '../components/Form.css';

type Shows = 'column-text' | 'column-image' | 'text' | 'color';

const SHOWS: { value: Shows; label: string }[] = [
  { value: 'column-text', label: 'Column as text' },
  { value: 'column-image', label: 'Column as image' },
  { value: 'text', label: 'Fixed text' },
  { value: 'color', label: 'Colour' },
];

/** A new colour box's colour, until one is chosen: the default layout's plate. */
const NEW_COLOR = '#e3e7ee';

function showsOf(content: BoxContent): Shows {
  if (content.kind === 'column') return content.as === 'image' ? 'column-image' : 'column-text';
  return content.kind;
}

interface ColorFieldProps {
  label: string;
  value: string | undefined;
  onChange: (color: string) => void;
}

/**
 * A colour as a hex field, so it can always be typed, beside the browser's own
 * picker. A hex code that isn't one yet is shown as an error and not saved.
 */
function ColorField({ label, value, onChange }: ColorFieldProps) {
  const id = useId();
  const errorId = useId();
  const [draft, setDraft] = useState(value ?? '');
  const invalid = draft.trim() !== '' && !parseHexColor(draft);

  function type(text: string) {
    setDraft(text);
    const color = parseHexColor(text);
    if (color) onChange(color);
  }

  function pick(color: string) {
    setDraft(color);
    onChange(color);
  }

  return (
    <div className="form-field">
      <label className="form-label" htmlFor={id}>
        {label}
      </label>
      <div className="box-properties__color">
        <input
          id={id}
          className="form-input box-properties__hex"
          value={draft}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          onChange={(event) => type(event.target.value)}
        />
        <input
          type="color"
          className="box-properties__swatch"
          aria-label={`${label} picker`}
          value={parseHexColor(value ?? '') ?? '#000000'}
          onChange={(event) => pick(event.target.value)}
        />
      </div>
      {invalid && (
        <p id={errorId} className="form-error">
          Enter a hex colour, such as #29303b.
        </p>
      )}
    </div>
  );
}

interface BoxFieldsProps {
  box: LayoutBox;
  columns: readonly string[];
  onChange: (box: LayoutBox) => void;
}

function BoxFields({ box, columns, onChange }: BoxFieldsProps) {
  const id = useId();
  const { content } = box;
  const shows = showsOf(content);
  const [columnDraft, setColumnDraft] = useState(content.kind === 'column' ? content.columns.join(', ') : '');
  // What the box showed before its kind changed, so switching back keeps it.
  const kept = useRef({
    columns: content.kind === 'column' ? content.columns : [],
    text: content.kind === 'text' ? content.text : '',
  });

  function setContent(next: BoxContent, style = box.style) {
    if (next.kind === 'column') kept.current.columns = next.columns;
    if (next.kind === 'text') kept.current.text = next.text;
    onChange({ ...box, content: next, style });
  }

  function setShows(value: Shows) {
    if (value === 'text') setContent({ kind: 'text', text: kept.current.text });
    else if (value === 'color') setContent({ kind: 'color' }, { ...box.style, background: box.style.background ?? NEW_COLOR });
    else
      setContent({
        kind: 'column',
        columns: kept.current.columns,
        as: value === 'column-image' ? 'image' : 'text',
      });
  }

  function setColumns(text: string) {
    setColumnDraft(text);
    if (content.kind === 'column') setContent({ ...content, columns: parseColumns(text) });
  }

  function setLabel(text: string) {
    const next: LayoutBox = { ...box, label: text };
    if (!text.trim()) delete next.label;
    onChange(next);
  }

  return (
    <>
      <fieldset className="form-choices box-properties__shows">
        <legend className="form-label">Shows</legend>
        {SHOWS.map(({ value, label }) => (
          <label key={value} className="form-choice">
            <input type="radio" name={`${id}-shows`} value={value} checked={shows === value} onChange={() => setShows(value)} />
            <span className="form-choice__name">{label}</span>
          </label>
        ))}
      </fieldset>

      {content.kind === 'column' && (
        <div className="form-field">
          <label className="form-label" htmlFor={`${id}-column`}>
            Column
          </label>
          <input
            id={`${id}-column`}
            className="form-input"
            list={columns.length ? `${id}-columns` : undefined}
            value={columnDraft}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="none"
            aria-describedby={`${id}-column-hint`}
            onChange={(event) => setColumns(event.target.value)}
          />
          {columns.length > 0 && (
            <datalist id={`${id}-columns`}>
              {columns.map((column) => (
                <option key={column} value={column} />
              ))}
            </datalist>
          )}
          <p id={`${id}-column-hint`} className="box-properties__hint">
            The CSV column to show, such as cost. For alternatives, separate them with commas: the first with a value shows.
          </p>
        </div>
      )}

      {content.kind === 'text' && (
        <div className="form-field">
          <label className="form-label" htmlFor={`${id}-text`}>
            Text
          </label>
          <textarea
            id={`${id}-text`}
            className="form-input box-properties__text"
            rows={3}
            value={content.text}
            onChange={(event) => setContent({ kind: 'text', text: event.target.value })}
          />
        </div>
      )}

      {content.kind === 'color' && (
        <ColorField label="Colour" value={box.style.background} onChange={(background) => onChange({ ...box, style: { ...box.style, background } })} />
      )}

      {shows !== 'column-image' && shows !== 'color' && (
        <div className="form-field">
          <label className="form-label" htmlFor={`${id}-label`}>
            Spoken label
          </label>
          <input
            id={`${id}-label`}
            className="form-input"
            value={box.label ?? ''}
            autoComplete="off"
            aria-describedby={`${id}-label-hint`}
            onChange={(event) => setLabel(event.target.value)}
          />
          <p id={`${id}-label-hint`} className="box-properties__hint">
            Optional. Screen readers say it before the box&apos;s text, such as Cost.
          </p>
        </div>
      )}
    </>
  );
}

interface BoxPropertiesProps {
  /** The chosen box, if any. */
  box?: LayoutBox;
  /** The chosen box's name, such as "Box 2". */
  name?: string;
  /** Column names from the loaded cards, suggested in the Column field. */
  columns: readonly string[];
  onChange: (box: LayoutBox) => void;
}

/**
 * The layout editor's box properties (LY-3, LY-5): what the chosen box shows,
 * a column as text or image, fixed text or a colour, and its spoken label.
 * Always shown, so choosing a box doesn't resize the canvas.
 */
export function BoxProperties({ box, name, columns, onChange }: BoxPropertiesProps) {
  const headingId = useId();
  return (
    <section className="box-properties" aria-labelledby={headingId}>
      <h4 id={headingId} className="box-properties__title">
        {box ? `${name} properties` : 'Box properties'}
      </h4>
      {box ? (
        <BoxFields key={box.id} box={box} columns={columns} onChange={onChange} />
      ) : (
        <p className="box-properties__empty">Choose a box on the card to set what it shows.</p>
      )}
    </section>
  );
}
