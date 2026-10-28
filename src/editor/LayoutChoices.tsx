import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { LayoutItem } from '../layouts/LayoutsProvider';
import { DEFAULT_LAYOUT } from '../model/layout';
import { layoutNameKey } from '../model/layoutChoice';
import { useOption, useSetOption } from '../storage/StorageProvider';
import { FieldControl, FieldError } from '../components/FieldError';

/** The select value for "no mapping": the type's cards use the default layout. */
const USE_DEFAULT = '';

interface LayoutChoicesProps {
  /** Saved layouts, in list order. */
  layouts: readonly LayoutItem[];
  /** Card types in the loaded cards (LY-8). */
  types?: readonly string[];
  announce: (text: string) => void;
}

const NO_TYPES: readonly string[] = [];

/**
 * Which layout a card gets when its `layout` column doesn't name one (LY-8):
 * the layout for each card type, and the default layout. Both are options,
 * read and set through the resolver (AR-7), so cards in play follow at once (LY-10).
 */
export function LayoutChoices({ layouts, types = NO_TYPES, announce }: LayoutChoicesProps) {
  const headingId = useId();
  const id = useId();
  const layoutByType = useOption('layoutByType');
  const defaultLayout = useOption('defaultLayout');
  const setOption = useSetOption();
  /** Types added by hand this visit, before they're mapped or loaded. */
  const [added, setAdded] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string>();
  /** The type whose picker to focus once it has rendered. */
  const pendingFocus = useRef<string>(undefined);
  const listRef = useRef<HTMLUListElement>(null);

  const layoutName = (layoutId: string | null) => layouts.find((layout) => layout.id === layoutId)?.name;
  const savedDefault = layoutName(defaultLayout) === undefined ? USE_DEFAULT : (defaultLayout ?? USE_DEFAULT);

  // Loaded spellings first, then hand-added ones, then mapped types no loaded card has (stored lowercased).
  const rows = new Map<string, string>();
  for (const type of [...types, ...added, ...Object.keys(layoutByType)]) {
    const key = layoutNameKey(type);
    if (key && !rows.has(key)) rows.set(key, type.trim());
  }
  const sortedRows = [...rows].sort(([, a], [, b]) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  useEffect(() => {
    const key = pendingFocus.current;
    if (!key) return;
    pendingFocus.current = undefined;
    listRef.current?.querySelector<HTMLElement>(`[data-type="${CSS.escape(key)}"] select`)?.focus();
  });

  function mappedTo(key: string): string {
    const mapped = Object.entries(layoutByType).find(([type]) => layoutNameKey(type) === key)?.[1];
    // A mapping to a deleted layout falls through to the default, so it shows as that.
    return mapped && layoutName(mapped) !== undefined ? mapped : USE_DEFAULT;
  }

  function setType(key: string, type: string, layoutId: string) {
    const next = Object.fromEntries(Object.entries(layoutByType).filter(([existing]) => layoutNameKey(existing) !== key));
    if (layoutId !== USE_DEFAULT) next[key] = layoutId;
    setOption('layoutByType', next);
    const name = layoutName(layoutId);
    announce(name ? `${type} cards use ${name}.` : `${type} cards use the default layout.`);
  }

  function setDefault(layoutId: string) {
    setOption('defaultLayout', layoutId === USE_DEFAULT ? null : layoutId);
    announce(`Cards with no other layout use ${layoutName(layoutId) ?? DEFAULT_LAYOUT.name}.`);
  }

  function addType(event: FormEvent) {
    event.preventDefault();
    const type = draft.trim();
    const key = layoutNameKey(type);
    if (!key) {
      setError('Enter a card type.');
      return;
    }
    if (rows.has(key)) {
      setError(`${rows.get(key)} is already listed.`);
      return;
    }
    setAdded((current) => [...current, type]);
    setDraft('');
    setError(undefined);
    pendingFocus.current = key;
    announce(`Added ${type}. Choose its layout.`);
  }

  return (
    <section className="layout-choices" aria-labelledby={headingId}>
      <h3 id={headingId} className="layout-choices__title">
        Choosing layouts
      </h3>
      <p className="layout-choices__intro">
        A card's <code>layout</code> column picks a layout by name. Cards without one use their type's layout, then the default layout.
      </p>

      <div className="layout-choices__row">
        <label htmlFor={`${id}-default`} className="layout-choices__label">
          Default layout
        </label>
        <select id={`${id}-default`} className="form-input layout-choices__select" value={savedDefault} onChange={(event) => setDefault(event.target.value)}>
          <option value={USE_DEFAULT}>{DEFAULT_LAYOUT.name} (built in)</option>
          {layouts.map((layout) => (
            <option key={layout.id} value={layout.id}>
              {layout.name}
            </option>
          ))}
        </select>
      </div>

      <h4 className="layout-choices__subtitle" id={`${id}-types`}>
        Card types
      </h4>
      {sortedRows.length === 0 ? (
        <p className="layout-choices__empty">No card types yet. Load a CSV with a type column, or add a type.</p>
      ) : (
        <ul ref={listRef} className="layout-choices__types" aria-labelledby={`${id}-types`}>
          {sortedRows.map(([key, type]) => (
            <li key={key} className="layout-choices__row" data-type={key}>
              <label htmlFor={`${id}-type-${key}`} className="layout-choices__label">
                {type}
              </label>
              <select
                id={`${id}-type-${key}`}
                className="form-input layout-choices__select"
                // Says what the picker sets, and contains the visible type (WCAG 2.5.3).
                aria-label={`Layout for ${type} cards`}
                value={mappedTo(key)}
                onChange={(event) => setType(key, type, event.target.value)}
              >
                <option value={USE_DEFAULT}>Use default layout</option>
                {layouts.map((layout) => (
                  <option key={layout.id} value={layout.id}>
                    {layout.name}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      )}

      <form className="layout-choices__add" onSubmit={addType} noValidate>
        <div className="layout-choices__add-field">
          <label htmlFor={`${id}-add`} className="form-label">
            Card type
          </label>
          <FieldControl invalid={error !== undefined}>
            <input
              id={`${id}-add`}
              className="form-input"
              value={draft}
              autoComplete="off"
              aria-invalid={error !== undefined}
              aria-describedby={error ? `${id}-error` : undefined}
              onChange={(event) => {
                setDraft(event.target.value);
                setError(undefined);
              }}
            />
          </FieldControl>
        </div>
        <button type="submit" className="button">
          Add type
        </button>
        {error && (
          <FieldError id={`${id}-error`} className="layout-choices__error">
            {error}
          </FieldError>
        )}
      </form>
    </section>
  );
}
