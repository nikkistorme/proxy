import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { moveCard, type Destination } from '../actions/moveCard';
import { draw, revealTop, shuffle } from '../actions/pileActions';
import { useGameStore } from '../store/gameStore';
import { CardFace, cardFaceLabel } from './CardFace';
import { LiveRegion } from './LiveRegion';
import { filterColumns, filterEntries, pileEntries, type PileEntry } from './pileFilter';
import './Form.css';
import './PileViewer.css';
import { seatIdentity } from './seatIdentity';

const ICONS = {
  shuffle: 'M4 7h3l10 10h3M4 17h3l3-3M14 10l3-3h3M18 4l2 3-2 3M18 14l2 3-2 3',
  draw: 'M12 4v12M7 11l5 5 5-5M5 20h14',
  reveal: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z',
};

const CARD_WIDTH = 150;

interface PileViewerProps {
  /** The pile to show, or undefined when the viewer is closed. */
  pileId: string | undefined;
  /** Called once whenever the viewer closes: Esc or the close button. */
  onClose: () => void;
}

/**
 * A card's name: everything printed on it, so screen readers can read the
 * cards, then its place in the pile.
 */
function cardLabel(entry: PileEntry): string {
  return `${cardFaceLabel(entry.face).replace(/[.!?]+$/, '')}. #${entry.position} from top`;
}

/** How many grid columns the results have, for moving up and down a row. */
function columnCount(list: HTMLElement | null): number {
  if (!list) return 1;
  return Math.max(1, getComputedStyle(list).gridTemplateColumns.split(' ').filter(Boolean).length);
}

/**
 * SP-7, SP-8: a modal sheet showing every card in a pile face up, following the
 * PileViewer board, with search, column filters, and moves to hand or table.
 */
export function PileViewer({ pileId, onClose }: PileViewerProps) {
  const game = useGameStore((s) => s.game);
  const dispatch = useGameStore((s) => s.dispatch);
  const announce = useGameStore((s) => s.announce);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  /** A card id, or 'search', to focus once the page has updated after a move. */
  const pendingFocusRef = useRef<string>(undefined);
  const titleId = useId();
  const searchId = useId();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [currentId, setCurrentId] = useState<string>();

  const pile = game.piles.find((p) => p.id === pileId);
  const open = pile !== undefined;
  const entries = useMemo(() => (pileId ? pileEntries(game, pileId) : []), [game, pileId]);
  const columns = useMemo(() => filterColumns(entries), [entries]);
  const matches = useMemo(() => filterEntries(entries, { search, filters }), [entries, search, filters]);
  // The card that holds the tab stop and shows its actions; the first match until one is chosen.
  const current = matches.find((m) => m.cardId === currentId) ?? matches[0];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      searchRef.current?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Focus the next card (or the search) once a move has re-rendered the list.
  useEffect(() => {
    const pending = pendingFocusRef.current;
    if (!pending) return;
    pendingFocusRef.current = undefined;
    if (pending === 'search') searchRef.current?.focus();
    else listRef.current?.querySelector<HTMLElement>(`[data-card-id="${pending}"]`)?.focus();
  });

  const close = () => dialogRef.current?.close();

  function focusCard(entry: PileEntry | undefined) {
    if (!entry) return;
    setCurrentId(entry.cardId);
    listRef.current?.querySelector<HTMLElement>(`[data-card-id="${entry.cardId}"]`)?.focus();
  }

  /** SP-8: move a card out of the pile, then focus the match that takes its place. */
  function move(entry: PileEntry, to: Destination) {
    const index = matches.indexOf(entry);
    const next = matches[index + 1] ?? matches[index - 1];
    dispatch((g) => moveCard(g, { cardId: entry.cardId, to }));
    setCurrentId(next?.cardId);
    pendingFocusRef.current = next?.cardId ?? 'search';
  }

  const activeSeat = game.seats.find((s) => s.id === game.activeSeatId);
  const hasHand = activeSeat?.hasHand ?? false;

  function toHand(entry: PileEntry) {
    if (activeSeat && hasHand) move(entry, { zone: 'hand', seatId: activeSeat.id });
    else if (activeSeat) announce(`${activeSeat.name} has no hand.`);
  }

  function toTable(entry: PileEntry) {
    move(entry, { zone: 'table' });
  }

  function onCardKeyDown(event: KeyboardEvent<HTMLButtonElement>, entry: PileEntry) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const index = matches.indexOf(entry);
    const across = columnCount(listRef.current);
    switch (event.key) {
      case 'ArrowRight':
        focusCard(matches[index + 1]);
        break;
      case 'ArrowLeft':
        focusCard(matches[index - 1]);
        break;
      case 'ArrowDown':
        focusCard(matches[Math.min(index + across, matches.length - 1)]);
        break;
      case 'ArrowUp':
        if (index < across) searchRef.current?.focus();
        else focusCard(matches[index - across]);
        break;
      case 'Home':
        focusCard(matches[0]);
        break;
      case 'End':
        focusCard(matches[matches.length - 1]);
        break;
      case 'Enter':
        toHand(entry);
        break;
      case 't':
      case 'T':
        toTable(entry);
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'ArrowDown' || !current) return;
    event.preventDefault();
    focusCard(current);
  }

  function clearSearch() {
    setSearch('');
    searchRef.current?.focus();
  }

  function clearAll() {
    setSearch('');
    setFilters({});
    searchRef.current?.focus();
  }

  const count = entries.length;
  const cardCount = `${count} ${count === 1 ? 'card' : 'cards'}`;
  const chosenFilters = columns.filter((c) => filters[c.column]);
  const filtered = search.trim() !== '' || chosenFilters.length > 0;
  const summary = [
    filtered ? `${matches.length} of ${count} match${search.trim() ? ` “${search.trim()}”` : ''}` : cardCount,
    ...chosenFilters.map((c) => `${c.label}: ${filters[c.column]}`),
  ].join(' · ');
  const identity = seatIdentity(pile?.ownerSeatId);
  const canDraw = count > 0;
  const canShuffle = count > 1;

  return (
    // Esc fires the dialog's close event, which reports back through onClose.
    <dialog
      ref={dialogRef}
      className="pile-viewer"
      aria-labelledby={titleId}
      style={{ borderTopColor: identity.color }}
      onClose={onClose}
    >
      {pile && (
        <>
          <div className="pile-viewer__header">
            <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true">
              <path d={identity.shape} fill={identity.color} />
            </svg>
            <h2 id={titleId} className="pile-viewer__title">
              {pile.name}
            </h2>
            <span className="pile-viewer__meta">{cardCount} · shown face up to you only</span>
            <button type="button" className="icon-button pile-viewer__close" aria-label="Close pile viewer (Esc)" onClick={close}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <div className="pile-viewer__controls">
            <div className="form-field pile-viewer__search">
              <label htmlFor={searchId} className="form-label">
                Search name or text
              </label>
              <div className="pile-viewer__search-box">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13zM20 20l-4.8-4.8" />
                </svg>
                <input
                  ref={searchRef}
                  id={searchId}
                  type="text"
                  className="form-input"
                  autoComplete="off"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={onSearchKeyDown}
                />
                {search && (
                  <button type="button" className="icon-button pile-viewer__clear" aria-label="Clear search" onClick={clearSearch}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            {columns.map((column) => {
              const id = `${searchId}-${column.column}`;
              const value = filters[column.column] ?? '';
              return (
                <div key={column.column} className="form-field">
                  <label htmlFor={id} className="form-label">
                    {column.label}
                  </label>
                  <select
                    id={id}
                    className={value ? 'pile-viewer__filter pile-viewer__filter--active' : 'pile-viewer__filter'}
                    value={value}
                    onChange={(e) => setFilters((f) => ({ ...f, [column.column]: e.target.value }))}
                  >
                    <option value="">Any</option>
                    {column.values.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>

          <div className="pile-viewer__summary">
            <span role="status">{summary}</span>
            {filtered && (
              <button type="button" className="pile-viewer__clear-all" onClick={clearAll}>
                Clear all
              </button>
            )}
            <span className="pile-viewer__sort">Sort: deck order</span>
          </div>

          <div className="pile-viewer__results">
            {matches.length === 0 ? (
              <p className="pile-viewer__empty">{count === 0 ? 'This pile is empty.' : 'No cards match.'}</p>
            ) : (
              <ul ref={listRef} className="pile-viewer__grid" aria-label="Matching cards">
                {matches.map((entry) => {
                  const isCurrent = entry === current;
                  return (
                    <li key={entry.cardId} className="pile-viewer__item">
                      {/* Like the pile tiles: the card is a decorative layer under a button that names it. */}
                      <div className="pile-viewer__frame">
                        <div aria-hidden="true">
                          <CardFace face={entry.face} width={CARD_WIDTH} />
                        </div>
                        <button
                          type="button"
                          className="pile-viewer__card"
                          data-card-id={entry.cardId}
                          tabIndex={isCurrent ? 0 : -1}
                          aria-label={cardLabel(entry)}
                          aria-keyshortcuts="Enter T"
                          onClick={() => setCurrentId(entry.cardId)}
                          onFocus={() => setCurrentId(entry.cardId)}
                          onKeyDown={(e) => onCardKeyDown(e, entry)}
                        />
                      </div>
                      <span className="pile-viewer__position" aria-hidden="true">
                        <span className="pile-viewer__number">#{entry.position}</span> from top
                      </span>
                      {isCurrent && (
                        <div className="pile-viewer__actions">
                          <button
                            type="button"
                            className="pile-viewer__action pile-viewer__action--primary"
                            aria-label={`To hand: ${entry.face.name}`}
                            onClick={() => toHand(entry)}
                          >
                            To hand
                          </button>
                          <button
                            type="button"
                            className="pile-viewer__action"
                            aria-label={`To table: ${entry.face.name}`}
                            onClick={() => toTable(entry)}
                          >
                            To table
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="pile-viewer__footer">
            <button
              type="button"
              className="pile-viewer__tool"
              aria-disabled={!canShuffle || undefined}
              onClick={() => canShuffle && dispatch((g, context) => shuffle(g, { pileId: pile.id }, context))}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={ICONS.shuffle} />
              </svg>
              Shuffle
            </button>
            <button
              type="button"
              className="pile-viewer__tool"
              aria-disabled={!canDraw || undefined}
              onClick={() => {
                if (!canDraw) return;
                if (hasHand) dispatch((g) => draw(g, { pileId: pile.id }));
                else if (activeSeat) announce(`${activeSeat.name} has no hand.`);
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={ICONS.draw} />
              </svg>
              Draw top card
            </button>
            <button
              type="button"
              className="pile-viewer__tool"
              aria-disabled={!canDraw || undefined}
              onClick={() => canDraw && dispatch((g) => revealTop(g, { pileId: pile.id }))}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={ICONS.reveal} />
              </svg>
              Reveal top card
            </button>
            <span className="pile-viewer__hint" aria-hidden="true">
              Arrows browse · Enter to hand · T to table · Esc close
            </span>
          </div>
          {/* The page's live region is outside this modal, where screen readers may not hear it. */}
          <LiveRegion />
        </>
      )}
    </dialog>
  );
}
