import { useCallback, useEffect, type PointerEvent } from 'react';
import type { StoreApi } from 'zustand/vanilla';
import type { Destination } from '../actions/moveCard';
import type { Rotation } from '../model/game';
import { cardBox, clampToTable } from '../model/tablePlacement';
import { snapToGrid } from '../model/tableView';
import { useGameStoreApi, type GameStore } from '../store/gameStore';
import './CardDrag.css';

/** How far a mouse can move and still be a click, not a drag, in screen px. */
export const DRAG_SLOP = 5;
/** How long a finger rests on a card before it lifts for dragging. Moving sooner scrolls instead. */
export const TOUCH_HOLD_MS = 250;

/** A card that can be dragged, and what happens when it's dropped. */
export interface DragSource {
  cardId: string;
  /** The name it's announced by. */
  name: string;
  /** The card as drawn, copied for the card under the pointer. */
  visual: HTMLElement;
  /** How much the visual is scaled on screen, like the table's zoom. */
  scale: number;
  rotation: Rotation;
  /** Where the card is now. Dropping it here puts it back. */
  from: Destination;
  /** Moves the card through the same action as a keyboard move. */
  drop: (to: Destination) => void;
  /** The drag ended without a move: the card stays where it was. */
  cancel: () => void;
}

interface Session {
  store: StoreApi<GameStore>;
  source: DragSource;
  pointerId: number;
  start: { x: number; y: number };
  /** Where in the card the pointer took hold, as a fraction of its size. */
  grab: { x: number; y: number };
  size: { width: number; height: number };
  started: boolean;
  timer?: number;
  ghost?: HTMLElement;
  over?: Destination;
}

/** One drag at a time, across the table and the hand. */
let session: Session | undefined;

const sameDestination = (a: Destination | undefined, b: Destination | undefined) => JSON.stringify(a) === JSON.stringify(b);

/** Where a drop at the pointer lands: a spot on the table, the top of a pile, or a hand. */
function destinationAt(current: Session, x: number, y: number): Destination | undefined {
  const zone = document.elementFromPoint?.(x, y)?.closest<HTMLElement>('[data-drop-zone]');
  if (!zone) return undefined;
  const { dropZone: kind, pileId, seatId } = zone.dataset;
  if (kind === 'pile' && pileId) return { zone: 'pile', pileId, position: 'top' };
  if (kind === 'hand' && seatId) return { zone: 'hand', seatId };
  if (kind !== 'table') return undefined;
  const { zoom, snap } = current.store.getState().view;
  const { rotation } = current.source;
  const rect = zone.getBoundingClientRect();
  // The card's box keeps the pointer where it took hold, at the table's size.
  const box = cardBox({ x: 0, y: 0, rotation });
  const left = (x - rect.left) / zoom - current.grab.x * (box.right - box.left);
  const top = (y - rect.top) / zoom - current.grab.y * (box.bottom - box.top);
  const spot = { x: Math.round(left - box.left), y: Math.round(top - box.top) };
  return { zone: 'table', position: clampToTable(snap ? snapToGrid(spot) : spot, rotation) };
}

function moveGhost(current: Session, x: number, y: number) {
  if (!current.ghost) return;
  const left = x - current.grab.x * current.size.width;
  const top = y - current.grab.y * current.size.height;
  current.ghost.style.transform = `translate(${left}px, ${top}px)`;
}

/** Lifts the card: a copy follows the pointer, and the store marks where it came from. */
function begin(current: Session, x: number, y: number) {
  const { source, store } = current;
  current.started = true;
  window.clearTimeout(current.timer);
  const ghost = document.createElement('div');
  ghost.className = 'drag-ghost';
  ghost.setAttribute('aria-hidden', 'true');
  ghost.style.width = `${current.size.width}px`;
  ghost.style.height = `${current.size.height}px`;
  const lift = document.createElement('div');
  lift.className = 'drag-ghost__lift';
  const copy = source.visual.cloneNode(true) as HTMLElement;
  // A copy only: nothing in it can be focused or found.
  copy.querySelectorAll('button').forEach((button) => button.remove());
  copy.removeAttribute('data-card-id');
  copy.classList.add('drag-ghost__card');
  copy.style.transform = source.scale === 1 ? '' : `scale(${source.scale})`;
  lift.append(copy);
  ghost.append(lift);
  document.body.append(ghost);
  document.body.classList.add('is-dragging-card');
  current.ghost = ghost;
  moveGhost(current, x, y);
  store.getState().setDrag({ cardId: source.cardId });
  store.getState().announce(`Dragging ${source.name}. Escape cancels.`);
  update(current, x, y);
}

function update(current: Session, x: number, y: number) {
  moveGhost(current, x, y);
  const target = destinationAt(current, x, y);
  // Dropping a hand card back in its own hand isn't a move.
  const over = target && !(target.zone !== 'table' && sameDestination(target, current.source.from)) ? target : undefined;
  if (sameDestination(over, current.over)) return;
  current.over = over;
  current.store.getState().setDrag({ cardId: current.source.cardId, over });
}

function onPointerMove(event: globalThis.PointerEvent) {
  const current = session;
  if (!current || event.pointerId !== current.pointerId) return;
  if (current.started) {
    update(current, event.clientX, event.clientY);
    return;
  }
  if (Math.hypot(event.clientX - current.start.x, event.clientY - current.start.y) <= DRAG_SLOP) return;
  // A finger that moves before it has rested on the card is scrolling.
  if (event.pointerType === 'touch') end();
  else begin(current, event.clientX, event.clientY);
}

function onPointerUp(event: globalThis.PointerEvent) {
  const current = session;
  if (!current || event.pointerId !== current.pointerId) return;
  if (current.started) update(current, event.clientX, event.clientY);
  finish(current);
}

function onPointerCancel(event: globalThis.PointerEvent) {
  const current = session;
  if (!current || event.pointerId !== current.pointerId) return;
  current.over = undefined;
  finish(current);
}

function onKeyDown(event: KeyboardEvent) {
  const current = session;
  if (!current?.started || event.key !== 'Escape') return;
  event.preventDefault();
  event.stopPropagation();
  current.over = undefined;
  finish(current);
}

/** The browser's own long-press menu would open over the card being dragged. */
function onContextMenu(event: Event) {
  if (!session) return;
  event.preventDefault();
  event.stopPropagation();
}

/** A drag's own pointerup would otherwise click the card, which opens a hand card's menu. */
function swallowClick(event: Event) {
  event.preventDefault();
  event.stopPropagation();
}

/** Ends the drag: drops the card on the target under it, or leaves it where it was. */
function finish(current: Session) {
  const { started, over, source } = current;
  end();
  if (!started) return;
  window.addEventListener('click', swallowClick, true);
  window.setTimeout(() => window.removeEventListener('click', swallowClick, true));
  if (over && !sameDestination(over, source.from)) source.drop(over);
  else source.cancel();
}

function end() {
  const current = session;
  if (!current) return;
  session = undefined;
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
  if (session?.started) event.preventDefault();
}

/**
 * TT-4: pointer dragging for cards. Call the returned function from a card's
 * pointerdown. A mouse drags once it moves past `DRAG_SLOP`; a finger has to rest
 * on the card for `TOUCH_HOLD_MS` first, so a swipe still scrolls. Escape, or a
 * drop outside any target, leaves the card where it was.
 */
export function useCardDrag() {
  const store = useGameStoreApi();

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
      const current: Session = {
        store,
        source,
        pointerId: event.pointerId,
        start: { x: event.clientX, y: event.clientY },
        grab: { x: (event.clientX - rect.left) / width, y: (event.clientY - rect.top) / height },
        size: { width: rect.width, height: rect.height },
        started: false,
      };
      session = current;
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerCancel);
      window.addEventListener('keydown', onKeyDown, true);
      window.addEventListener('contextmenu', onContextMenu, true);
      if (event.pointerType === 'touch') {
        const { clientX, clientY } = event;
        current.timer = window.setTimeout(() => {
          if (session === current) begin(current, clientX, clientY);
        }, TOUCH_HOLD_MS);
      }
    },
    [store],
  );
}
