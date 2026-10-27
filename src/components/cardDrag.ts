import { useCallback, useEffect, type PointerEvent } from 'react';
import type { StoreApi } from 'zustand/vanilla';
import type { Destination } from '../actions/moveCard';
import type { Rotation } from '../model/session';
import { cardBox, clampToTable, pileBox, pileUnder } from '../model/tablePlacement';
import { snapToGrid } from '../model/tableView';
import { useSessionStoreApi, type SessionStore } from '../store/sessionStore';
import './CardDrag.css';

/** How far a mouse can move and still be a click, not a drag, in screen px. */
export const DRAG_SLOP = 5;
/** How long a finger rests on a card before it lifts for dragging. Moving sooner scrolls instead. */
export const TOUCH_HOLD_MS = 250;

/** A card or pile that can be dragged, and what happens when it's dropped. */
interface DragSourceBase {
  /** The name it's announced by. */
  name: string;
  /** The card as drawn, copied for the card under the pointer. */
  visual: HTMLElement;
  /** How much the visual is scaled on screen, like the table's zoom. */
  scale: number;
  rotation: Rotation;
  /** Where the card is now. Dropping it here puts it back. A card inside a pile, below its top, is nowhere a drop can name. */
  from: Destination | undefined;
  /** Moves the card through the same action as a keyboard move. */
  drop: (to: Destination) => void;
  /** The drag ended without a move: the card stays where it was. */
  cancel: () => void;
  /** The card has lifted, before any target is looked for. The pile viewer gets out of the way here. */
  onLift?: () => void;
  /** A finger lifted it and let go without moving it: open its menu instead (table cards and piles). */
  onHoldRelease?: () => void;
}

/**
 * A card goes to the table, a pile or a hand. A pile moves on the table, or merges
 * with a pile it lands on (#56). A finger that lifts a pile or table card and lets
 * go without moving opens its menu instead.
 */
export type DragSource = DragSourceBase & ({ cardId: string; pileId?: undefined } | { pileId: string; cardId?: undefined; onHoldRelease: () => void });

interface ActiveDrag {
  store: StoreApi<SessionStore>;
  source: DragSource;
  pointerId: number;
  start: { x: number; y: number };
  /** Where in the card the pointer took hold, as a fraction of its size. */
  grab: { x: number; y: number };
  size: { width: number; height: number };
  started: boolean;
  /** A finger lifted the item and hasn't moved it since. */
  stillHeld: boolean;
  timer?: number;
  ghost?: HTMLElement;
  over?: Destination;
}

/** One drag at a time, across the table and the hand. */
let activeDrag: ActiveDrag | undefined;

/** What the store marks as being dragged. */
const dragged = ({ cardId, pileId }: DragSource) => (pileId === undefined ? { cardId } : { pileId });

const sameDestination = (a: Destination | undefined, b: Destination | undefined) => JSON.stringify(a) === JSON.stringify(b);

/**
 * TT-12: a card dragged within its own hand lands between the cards either side
 * of the pointer. Back in its own place, it's the hand it came from: no move.
 */
function handDestination(current: ActiveDrag, zone: HTMLElement, seatId: string, x: number): Destination {
  const { cardId, from } = current.source;
  const hand = current.store.getState().session.hands[seatId] ?? [];
  const fromIndex = cardId === undefined ? -1 : hand.indexOf(cardId);
  if (from?.zone !== 'hand' || from.seatId !== seatId || fromIndex < 0) return { zone: 'hand', seatId };
  // How many cards' middles are left of the pointer: the gap the card drops into.
  let gap = 0;
  for (const card of zone.querySelectorAll<HTMLElement>('[data-hand-card-id]')) {
    const rect = card.getBoundingClientRect();
    if (x > rect.left + rect.width / 2) gap++;
  }
  const index = gap > fromIndex ? gap - 1 : gap;
  return index === fromIndex ? { zone: 'hand', seatId } : { zone: 'hand', seatId, index };
}

/** Where a drop at the pointer lands: a spot on the table, the top of a pile, or a hand. */
function destinationAt(current: ActiveDrag, x: number, y: number): Destination | undefined {
  // A pile lands on the table wherever it's dropped, even over a card. Over another pile, it merges with it.
  const zone = document.elementFromPoint?.(x, y)?.closest<HTMLElement>(current.source.pileId === undefined ? '[data-drop-zone]' : '[data-drop-zone="table"]');
  if (!zone) return undefined;
  const { dropZone: kind, pileId, seatId } = zone.dataset;
  if (kind === 'pile' && pileId) return { zone: 'pile', pileId, position: 'top' };
  if (kind === 'hand' && seatId) return handDestination(current, zone, seatId, x);
  if (kind !== 'table') return undefined;
  const { zoom, snap } = current.store.getState().view;
  const { rotation } = current.source;
  const rect = zone.getBoundingClientRect();
  // The card's box keeps the pointer where it took hold, at the table's size.
  const box = cardBox({ x: 0, y: 0, rotation });
  const left = (x - rect.left) / zoom - current.grab.x * (box.right - box.left);
  const top = (y - rect.top) / zoom - current.grab.y * (box.bottom - box.top);
  const spot = { x: Math.round(left - box.left), y: Math.round(top - box.top) };
  const position = clampToTable(snap ? snapToGrid(spot) : spot, rotation);
  const { pileId: draggedPileId } = current.source;
  if (draggedPileId !== undefined) {
    const under = pileUnder(current.store.getState().session.piles, pileBox(position), draggedPileId);
    if (under) return { zone: 'pile', pileId: under.id, position: 'top' };
  }
  return { zone: 'table', position };
}

function moveGhost(current: ActiveDrag, x: number, y: number) {
  if (!current.ghost) return;
  const left = x - current.grab.x * current.size.width;
  const top = y - current.grab.y * current.size.height;
  current.ghost.style.transform = `translate(${left}px, ${top}px)`;
}

/** Lifts the card: a copy follows the pointer, and the store marks where it came from. */
function begin(current: ActiveDrag, x: number, y: number) {
  const { source, store } = current;
  current.started = true;
  window.clearTimeout(current.timer);
  source.onLift?.();
  const ghost = document.createElement('div');
  ghost.className = 'drag-ghost';
  ghost.setAttribute('aria-hidden', 'true');
  ghost.style.width = `${current.size.width}px`;
  ghost.style.height = `${current.size.height}px`;
  const lift = document.createElement('div');
  lift.className = 'drag-ghost__lift';
  const copy = source.visual.cloneNode(true) as HTMLElement;
  // A copy only: nothing in it can be focused or found.
  // A pile's name plate is inside its button, so the copy keeps the button's content.
  copy.querySelectorAll('button').forEach((button) => {
    if (source.pileId === undefined) return button.remove();
    const content = document.createElement('div');
    content.className = button.className;
    content.append(...button.childNodes);
    button.replaceWith(content);
  });
  for (const element of [copy, ...copy.querySelectorAll('*')]) {
    for (const name of ['data-card-id', 'data-drop-zone', 'data-pile-id']) element.removeAttribute(name);
  }
  copy.classList.add('drag-ghost__card');
  copy.style.transform = source.scale === 1 ? '' : `scale(${source.scale})`;
  lift.append(copy);
  ghost.append(lift);
  document.body.append(ghost);
  document.body.classList.add('is-dragging-card');
  current.ghost = ghost;
  moveGhost(current, x, y);
  store.getState().setDrag(dragged(source));
  store.getState().announce(`Dragging ${source.name}. Escape cancels.`);
  update(current, x, y);
}

function update(current: ActiveDrag, x: number, y: number) {
  moveGhost(current, x, y);
  const target = destinationAt(current, x, y);
  // Dropping a hand card back in its own hand isn't a move.
  const over = target && !(target.zone !== 'table' && sameDestination(target, current.source.from)) ? target : undefined;
  if (sameDestination(over, current.over)) return;
  current.over = over;
  current.store.getState().setDrag({ ...dragged(current.source), over });
}

function onPointerMove(event: globalThis.PointerEvent) {
  const current = activeDrag;
  if (!current || event.pointerId !== current.pointerId) return;
  if (current.started) {
    if (Math.hypot(event.clientX - current.start.x, event.clientY - current.start.y) > DRAG_SLOP) current.stillHeld = false;
    update(current, event.clientX, event.clientY);
    return;
  }
  if (Math.hypot(event.clientX - current.start.x, event.clientY - current.start.y) <= DRAG_SLOP) return;
  // A finger that moves before it has rested on the card is scrolling.
  if (event.pointerType === 'touch') end();
  else begin(current, event.clientX, event.clientY);
}

function onPointerUp(event: globalThis.PointerEvent) {
  const current = activeDrag;
  if (!current || event.pointerId !== current.pointerId) return;
  if (current.started) update(current, event.clientX, event.clientY);
  finish(current);
}

function onPointerCancel(event: globalThis.PointerEvent) {
  const current = activeDrag;
  if (!current || event.pointerId !== current.pointerId) return;
  current.over = undefined;
  current.stillHeld = false;
  finish(current);
}

function onKeyDown(event: KeyboardEvent) {
  const current = activeDrag;
  if (!current?.started || event.key !== 'Escape') return;
  event.preventDefault();
  event.stopPropagation();
  current.over = undefined;
  current.stillHeld = false;
  finish(current);
}

/** The browser's own long-press menu would open over the card being dragged. */
function onContextMenu(event: Event) {
  if (!activeDrag) return;
  event.preventDefault();
  event.stopPropagation();
}

/**
 * A drag's own pointerup would otherwise click the card, which opens a hand card's
 * menu. A touch's click comes a little after the finger lifts, so this waits for it,
 * until the next press starts or a second has passed.
 */
function swallowNextClick() {
  const stop = () => {
    window.removeEventListener('click', swallow, true);
    window.removeEventListener('pointerdown', stop, true);
  };
  const swallow = (event: MouseEvent) => {
    // A click from the keyboard isn't the drag's.
    if (event.detail === 0) return;
    event.preventDefault();
    event.stopPropagation();
    stop();
  };
  window.addEventListener('click', swallow, true);
  window.addEventListener('pointerdown', stop, true);
  window.setTimeout(stop, 1000);
}

/** Ends the drag: drops the card on the target under it, or leaves it where it was. */
function finish(current: ActiveDrag) {
  const { started, over, source, stillHeld } = current;
  end();
  if (!started) return;
  swallowNextClick();
  if (stillHeld && source.onHoldRelease) source.onHoldRelease();
  else if (over && !sameDestination(over, source.from)) source.drop(over);
  else source.cancel();
}

function end() {
  const current = activeDrag;
  if (!current) return;
  activeDrag = undefined;
  window.clearTimeout(current.timer);
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', onPointerCancel);
  window.removeEventListener('keydown', onKeyDown, true);
  window.removeEventListener('contextmenu', onContextMenu, true);
  current.ghost?.remove();
  document.body.classList.remove('is-dragging-card');
  if (current.started) current.store.getState().setDrag(undefined);
}

/** Once a card has lifted, a finger moving it mustn't scroll the page too. */
function onTouchMove(event: TouchEvent) {
  if (activeDrag?.started) event.preventDefault();
}

/**
 * TT-4: pointer dragging for cards and piles. Call the returned function from a card's
 * pointerdown. A mouse drags once it moves past `DRAG_SLOP`; a finger has to rest
 * on the card for `TOUCH_HOLD_MS` first, so a swipe still scrolls. Escape, or a
 * drop outside any target, leaves the card where it was. Letting go of a held
 * pile or table card without moving it opens its menu.
 */
export function useCardDrag() {
  const store = useSessionStoreApi();

  // Registered up front: browsers only let a touch listener stop scrolling if it was there when the touch began.
  useEffect(() => {
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => document.removeEventListener('touchmove', onTouchMove);
  }, []);

  return useCallback(
    (event: PointerEvent, source: DragSource) => {
      // While placing, a press on the table moves the outline instead.
      if (store.getState().placing) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      end();
      const rect = source.visual.getBoundingClientRect();
      const width = rect.width || 1;
      const height = rect.height || 1;
      const current: ActiveDrag = {
        store,
        source,
        pointerId: event.pointerId,
        start: { x: event.clientX, y: event.clientY },
        grab: { x: (event.clientX - rect.left) / width, y: (event.clientY - rect.top) / height },
        size: { width: rect.width, height: rect.height },
        started: false,
        stillHeld: false,
      };
      activeDrag = current;
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerCancel);
      window.addEventListener('keydown', onKeyDown, true);
      window.addEventListener('contextmenu', onContextMenu, true);
      if (event.pointerType === 'touch') {
        const { clientX, clientY } = event;
        current.timer = window.setTimeout(() => {
          if (activeDrag !== current) return;
          current.stillHeld = true;
          begin(current, clientX, clientY);
        }, TOUCH_HOLD_MS);
      }
    },
    [store],
  );
}
