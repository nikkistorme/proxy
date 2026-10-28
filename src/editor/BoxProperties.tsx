import { useId, useRef, useState } from 'react';
import type { BoxContent, BoxStyle, LayoutBox } from '../model/layout';
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
/** A text box's background when No background is unticked. */
const NEW_BACKGROUND = '#ffffff';
/** Font sizes the Size field takes, in points on the printed card (LY-4). */
const MIN_SIZE = 4;
const MAX_SIZE = 72;

const WEIGHTS: { value: BoxStyle['weight']; label: string }[] = [
  { value: 400, label: 'Regular' },
  { value: 500, label: 'Medium' },
  { value: 600, label: 'Semibold' },
  { value: 700, label: 'Bold' },
];
const FONTS: { value: BoxStyle['font']; label: string }[] = [
  { value: 'sans', label: 'Text' },
  { value: 'mono', label: 'Numbers' },
];
const ALIGNS: { value: BoxStyle['align']; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Centre' },
  { value: 'right', label: 'Right' },
];
const VALIGNS: { value: BoxStyle['valign']; label: string }[] = [
  { value: 'top', label: 'Top' },
  { value: 'middle', label: 'Middle' },
  { value: 'bottom', label: 'Bottom' },
];

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

interface SegmentsProps<T extends string> {
  legend: string;
  name: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** A small radio group drawn as joined buttons, like the Portrait / Landscape choice. */
function Segments<T extends string>({ legend, name, options, value, onChange }: SegmentsProps<T>) {
  return (
    <fieldset className="box-properties__segments">
      <legend className="form-label">{legend}</legend>
      <div className="box-properties__segment-row">
        {options.map((option) => (
          <label key={option.value} className="layout-canvas__option box-properties__option">
            <input type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** The font size in points. A size out of range shows an error and isn't saved. */
function SizeField({ value, onChange }: { value: number; onChange: (size: number) => void }) {
  const id = useId();
  const [draft, setDraft] = useState(String(value));
  const size = Number(draft);
  const invalid = draft.trim() === '' || !Number.isFinite(size) || size < MIN_SIZE || size > MAX_SIZE;

  function type(text: string) {
    setDraft(text);
    const next = Number(text);
    if (text.trim() && Number.isFinite(next) && next >= MIN_SIZE && next <= MAX_SIZE) onChange(next);
  }

  return (
    <div className="form-field">
      <label className="form-label" htmlFor={id}>
        Size (pt)
      </label>
      <input
        id={id}
        className="form-input box-properties__size"
        type="number"
        inputMode="decimal"
        min={MIN_SIZE}
        max={MAX_SIZE}
        step={0.5}
        value={draft}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
        onChange={(event) => type(event.target.value)}
      />
      {invalid && (
        <p id={`${id}-error`} className="form-error">
          Enter a size from {MIN_SIZE} to {MAX_SIZE} pt.
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

  function setStyle(style: Partial<BoxStyle>) {
    onChange({ ...box, style: { ...box.style, ...style } });
  }

  function setNoBackground(none: boolean) {
    const style = { ...box.style };
    if (none) delete style.background;
    else style.background = NEW_BACKGROUND;
    onChange({ ...box, style });
  }

  const isText = shows === 'column-text' || shows === 'text';

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

      {isText && (
        <>
          <SizeField value={box.style.size} onChange={(size) => setStyle({ size })} />
          <div className="form-field">
            <label className="form-label" htmlFor={`${id}-weight`}>
              Weight
            </label>
            <select
              id={`${id}-weight`}
              className="form-input"
              value={box.style.weight}
              onChange={(event) => setStyle({ weight: Number(event.target.value) as BoxStyle['weight'] })}
            >
              {WEIGHTS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <Segments legend="Font" name={`${id}-font`} options={FONTS} value={box.style.font} onChange={(font) => setStyle({ font })} />
          <Segments legend="Align" name={`${id}-align`} options={ALIGNS} value={box.style.align} onChange={(align) => setStyle({ align })} />
          <Segments legend="Vertical align" name={`${id}-valign`} options={VALIGNS} value={box.style.valign} onChange={(valign) => setStyle({ valign })} />
          <ColorField label="Text colour" value={box.style.color} onChange={(color) => setStyle({ color })} />
        </>
      )}

      {shows !== 'color' && (
        <div className="box-properties__background">
          <label className="box-properties__check">
            <input type="checkbox" checked={box.style.background === undefined} onChange={(event) => setNoBackground(event.target.checked)} />
            No background
          </label>
          {box.style.background !== undefined && (
            <ColorField label="Background" value={box.style.background} onChange={(background) => setStyle({ background })} />
          )}
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
  /** What's wrong with the chosen box: clipped text, low contrast (LY-4, A11Y-9). */
  warnings?: readonly string[];
  onChange: (box: LayoutBox) => void;
}

/**
 * The layout editor's box properties (LY-3 to LY-5): what the chosen box shows,
 * a column as text or image, fixed text or a colour, its spoken label, and
 * how its text looks, with warnings for clipped text and low contrast.
 * Always shown, so choosing a box doesn't resize the canvas.
 */
export function BoxProperties({ box, name, columns, warnings = [], onChange }: BoxPropertiesProps) {
  const headingId = useId();
  return (
    <section className="box-properties" aria-labelledby={headingId}>
      <h4 id={headingId} className="box-properties__title">
        {box ? `${name} properties` : 'Box properties'}
      </h4>
      {box && warnings.length > 0 && (
        // Stays in view while the panel scrolls, so a change lower down shows its warning.
        <div className="box-properties__warnings">
          {warnings.map((warning) => (
            <p key={warning} className="box-properties__warning">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3l10 18H2z" />
                <path d="M12 10v5M12 18v.5" strokeLinecap="round" />
              </svg>
              {warning}
            </p>
          ))}
        </div>
      )}
      {box ? (
        <BoxFields key={box.id} box={box} columns={columns} onChange={onChange} />
      ) : (
        <p className="box-properties__empty">Choose a box on the card to set what it shows.</p>
      )}
    </section>
  );
}
