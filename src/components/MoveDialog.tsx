import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react';
import type { Destination } from '../actions/moveCard';
import type { CardFace as CardFaceData } from '../model/card';
import { CardFace } from './CardFace';
import { Dialog } from './Dialog';
import './Form.css';
import './MoveDialog.css';
import { matchDestinations, type DestinationGroup, type MatchedOption, type MoveOption } from './moveDestinations';
import { seatIdentity } from './seatIdentity';

export interface MoveRequest {
  cardId: string;
  face: CardFaceData;
  /** Where the card is now, for the eyebrow: "Move card · from P1 main deck". */
  fromName: string;
  options: MoveOption[];
}

interface MoveDialogProps {
  /** Give each request its own `key`, so every opening starts fresh. */
  request: MoveRequest | undefined;
  onConfirm: (destination: Destination) => void;
  onClose: () => void;
}

const GROUPS: DestinationGroup[] = ['Table', 'Hands', 'Piles'];
/** The table's mark: a mat with a card on it. */
const TABLE_SHAPE = 'M1.5 4h13v9h-13zM6 6h4v5H6z';

function Highlighted({ label, hit }: { label: string; hit: [number, number] }) {
  const [start, end] = hit;
  if (start === end) return <>{label}</>;
  return (
    <>
      {label.slice(0, start)}
      <mark className="move-dialog__hit">{label.slice(start, end)}</mark>
      {label.slice(end)}
    </>
  );
}

/**
 * SP-8: move a card to the table, a hand, or the top or bottom of any pile,
 * following the MoveDialog board. The search is a combobox over a grouped
 * listbox: ↑↓ choose, Enter moves, Esc cancels.
 */
export function MoveDialog({ request, onConfirm, onClose }: MoveDialogProps) {
  const searchId = useId();
  const listId = useId();
  const [search, setSearch] = useState('');
  const [activeKey, setActiveKey] = useState<string>();
  const [faceUp, setFaceUp] = useState(false);

  const options = useMemo(() => request?.options ?? [], [request]);
  const matches = useMemo(() => matchDestinations(options, search), [options, search]);
  // The chosen row: the one picked, or the first match.
  const active = matches.find((m) => m.option.key === activeKey) ?? matches[0];
  const optionId = (option: MoveOption) => `${listId}-${option.key}`;

  // Keep the chosen row in view as the choice moves through a long list.
  useEffect(() => {
    if (active) document.getElementById(optionId(active.option))?.scrollIntoView?.({ block: 'nearest' });
  });

  function choose(match: MatchedOption | undefined) {
    if (match) setActiveKey(match.option.key);
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const index = active ? matches.indexOf(active) : -1;
    if (event.key === 'ArrowDown') choose(matches[Math.min(index + 1, matches.length - 1)]);
    else if (event.key === 'ArrowUp') choose(matches[Math.max(index - 1, 0)]);
    else return;
    event.preventDefault();
  }

  function submit(): boolean {
    if (!active) return false;
    const to = active.option.destination;
    onConfirm(to.zone === 'pile' ? { ...to, faceUp } : to);
    return true;
  }

  const total = options.length;
  const countText = search.trim()
    ? `${matches.length} of ${total} ${total === 1 ? 'destination matches' : 'destinations match'}`
    : `${total} ${total === 1 ? 'destination' : 'destinations'}`;

  return (
    <Dialog
      open={request !== undefined}
      title={request?.face.name ?? ''}
      eyebrow={request && `Move card · from ${request.fromName}`}
      media={request && <CardFace face={request.face} width={56} />}
      hint="↑↓ choose · Enter move · Esc cancel"
      onClose={onClose}
      primaryLabel={active ? `Move to ${active.option.label}` : 'Move'}
      cancelLabel="Cancel"
      onSubmit={submit}
      width="medium"
    >
      <div className="form-field move-dialog__search">
        <label htmlFor={searchId} className="form-label">
          Find a destination
        </label>
        <div className="move-dialog__search-box">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13zM20 20l-4.8-4.8" />
          </svg>
          <input
            id={searchId}
            type="text"
            role="combobox"
            className="form-input"
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={active ? optionId(active.option) : undefined}
            data-autofocus
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setActiveKey(undefined);
            }}
            onKeyDown={onSearchKeyDown}
          />
        </div>
        <span role="status" className="move-dialog__count">
          {countText}
        </span>
      </div>

      <div id={listId} role="listbox" aria-label="Destinations" className="move-dialog__list">
        {matches.length === 0 && <p className="move-dialog__empty">No destination matches.</p>}
        {GROUPS.map((group) => {
          const rows = matches.filter((m) => m.option.group === group);
          if (rows.length === 0) return null;
          const headingId = `${listId}-group-${group}`;
          return (
            <div key={group} role="group" aria-labelledby={headingId}>
              <div id={headingId} className="move-dialog__group">
                {group}
              </div>
              {rows.map((match) => {
                const { option } = match;
                const selected = match === active;
                const identity = option.group === 'Table' ? undefined : seatIdentity(option.seatId);
                return (
                  // The search keeps keyboard focus and handles the keys (aria-activedescendant),
                  // so options take clicks only.
                  // eslint-disable-next-line jsx-a11y/click-events-have-key-events
                  <div
                    key={option.key}
                    id={optionId(option)}
                    role="option"
                    tabIndex={-1}
                    aria-selected={selected}
                    className={selected ? 'move-dialog__option move-dialog__option--selected' : 'move-dialog__option'}
                    // Keep focus in the search, so typing and the arrow keys carry on working.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(match)}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                      <path d={identity?.shape ?? TABLE_SHAPE} fill={identity?.color ?? 'var(--muted)'} fillRule="evenodd" />
                    </svg>
                    <span className="move-dialog__label">
                      <Highlighted label={option.label} hit={match.hit} />
                    </span>{' '}
                    <span className="move-dialog__meta">{option.meta}</span>
                    {selected && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12.5l4.5 4.5L19 7" />
                      </svg>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <label className="move-dialog__face-up">
        <input type="checkbox" checked={faceUp} onChange={(e) => setFaceUp(e.target.checked)} />
        Keep it face up (piles only)
      </label>
    </Dialog>
  );
}
