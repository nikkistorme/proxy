import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { cardBox, CARD_H, CARD_W, columnsFor } from '../model/tablePlacement';
import { nearestInDirection, readingOrder, type Direction } from '../model/tableNavigation';
import { clampZoom, fitAll, MAX_ZOOM, scrollAfterZoom, stepZoom, zoomPercent, type Scroll } from '../model/tableView';
import { bringToFront, deleteCard, duplicate, flip, rotate, sendToBack, shownName } from '../actions/cardActions';
import { moveCard, type Destination } from '../actions/moveCard';
import { useGameStore } from '../store/gameStore';
import { CardDetailsDialog } from './CardDetailsDialog';
import { CardMenu, type CardCommand } from './CardMenu';
import { moveDestinations } from './moveDestinations';
import { MoveDialog, type MoveRequest } from './MoveDialog';
import { TableCard } from './TableCard';
import { tableCardView } from './tableCardView';
import { TOAST_UNDO_ID } from './Toast';
import './TableSurface.css';

/**
 * Where focus goes once the table has re-rendered: a card, the toast's Undo, or
 * the table itself. 'none' leaves it to a dialog that has just opened.
 */
type FocusTarget = { card: string } | 'toast' | 'table' | 'none';

const ARROWS: Record<string, Direction> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
/** How far Shift+arrow pans, in screen px. */
const PAN_STEP = 64;

/**
 * The free-form table. Cards sit at their positions on a mat that pans and
 * zooms (TT-1) inside its own viewport. The table is one Tab stop, and arrow
 * keys move focus to the nearest card in that direction (A11Y-3).
 */
export function TableSurface() {
  const game = useGameStore((s) => s.game);
  const { zoom, snap } = useGameStore((s) => s.view);
  const setView = useGameStore((s) => s.setView);
  const announce = useGameStore((s) => s.announce);
  const setTableViewport = useGameStore((s) => s.setTableViewport);

  const dispatch = useGameStore((s) => s.dispatch);
  const showToast = useGameStore((s) => s.showToast);

  const [activeId, setActiveId] = useState<string>();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [menu, setMenu] = useState<{ cardId: string; rect: DOMRect }>();
  const [moveRequest, setMoveRequest] = useState<MoveRequest>();
  const [detailsCardId, setDetailsCardId] = useState<string>();
  const pendingFocus = useRef<FocusTarget>(undefined);
  const viewportRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({});
  /** Scroll to apply once the new zoom has rendered. */
  const pendingScroll = useRef<Scroll>(undefined);
  // The latest zoom and cards, for handlers registered once.
  const zoomRef = useRef(zoom);
  const tableRef = useRef(game.table);
  useLayoutEffect(() => {
    zoomRef.current = zoom;
    tableRef.current = game.table;
  });

  const register = useCallback((cardId: string, element: HTMLButtonElement | null) => {
    buttons.current[cardId] = element;
  }, []);

  // Track the viewport's size, for fit all and for a mat that always fills the view.
  useEffect(() => {
    const element = viewportRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setSize({ width: element.clientWidth, height: element.clientHeight }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Auto-placed cards fill the width you can see (TT-4).
  const columns = size.width > 0 ? columnsFor(size.width / zoom) : undefined;
  useEffect(() => {
    if (columns !== undefined) setView({ columns });
  }, [columns, setView]);

  /** Zooms to `next`, keeping the table point under `anchor` (viewport px, default the centre) in place. */
  const zoomTo = useCallback(
    (next: number, anchor?: { x: number; y: number }) => {
      const element = viewportRef.current;
      const from = zoomRef.current;
      const to = clampZoom(next);
      if (!element || to === from) return to;
      const point = anchor ?? { x: element.clientWidth / 2, y: element.clientHeight / 2 };
      pendingScroll.current = scrollAfterZoom({ left: element.scrollLeft, top: element.scrollTop }, point, from, to);
      zoomRef.current = to;
      setView({ zoom: to });
      return to;
    },
    [setView],
  );

  useLayoutEffect(() => {
    const element = viewportRef.current;
    const scroll = pendingScroll.current;
    if (!element || !scroll) return;
    pendingScroll.current = undefined;
    element.scrollLeft = scroll.left;
    element.scrollTop = scroll.top;
  }, [zoom]);

  // The toolbar and keys reach the viewport through the store.
  useEffect(() => {
    setTableViewport({
      stepZoom: (direction) => {
        const from = zoomRef.current;
        const to = zoomTo(stepZoom(from, direction));
        // Only the ends have no next step.
        if (to === from) announce(`Zoom is already at ${zoomPercent(from)}, the ${from >= MAX_ZOOM ? 'most' : 'least'}.`);
        else announce(`Zoom ${zoomPercent(to)}.`);
      },
      resetZoom: () => announce(`Zoom ${zoomPercent(zoomTo(1))}.`),
      fitAll: () => {
        const element = viewportRef.current;
        const table = tableRef.current;
        const fit = element && fitAll(table.map(cardBox), { width: element.clientWidth, height: element.clientHeight });
        if (!element || !fit) {
          announce('No cards on the table to fit.');
          return;
        }
        if (fit.zoom === zoomRef.current) {
          element.scrollLeft = fit.scroll.left;
          element.scrollTop = fit.scroll.top;
        } else {
          pendingScroll.current = fit.scroll;
          zoomRef.current = fit.zoom;
          setView({ zoom: fit.zoom });
        }
        announce(`Showing all ${table.length} ${table.length === 1 ? 'card' : 'cards'} at ${zoomPercent(fit.zoom)}.`);
      },
    });
    return () => setTableViewport(undefined);
  }, [setTableViewport, zoomTo, announce, setView]);

  // Ctrl/⌘+wheel (and a trackpad pinch, which sends the same) zooms around the pointer.
  // A plain wheel is left to scroll, so trackpads can still pan. A two-finger
  // touch pinch zooms around the fingers.
  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const pointIn = (clientX: number, clientY: number) => {
      const rect = element.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    };
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      zoomTo(zoomRef.current * Math.exp(-event.deltaY * 0.01), pointIn(event.clientX, event.clientY));
    };
    let pinch: { distance: number; zoom: number } | undefined;
    const spread = (touches: TouchList) => {
      const [a, b] = [touches[0], touches[1]];
      if (!a || !b) return undefined;
      return { distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), centre: pointIn((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2) };
    };
    const onTouchStart = (event: TouchEvent) => {
      const s = event.touches.length === 2 ? spread(event.touches) : undefined;
      pinch = s && s.distance > 0 ? { distance: s.distance, zoom: zoomRef.current } : undefined;
    };
    const onTouchMove = (event: TouchEvent) => {
      const s = event.touches.length === 2 ? spread(event.touches) : undefined;
      if (!pinch || !s) return;
      event.preventDefault();
      zoomTo(pinch.zoom * (s.distance / pinch.distance), s.centre);
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) pinch = undefined;
    };
    // Safari's own page pinch would fight ours.
    const stopGesture = (event: Event) => event.preventDefault();
    element.addEventListener('wheel', onWheel, { passive: false });
    element.addEventListener('touchstart', onTouchStart, { passive: true });
    element.addEventListener('touchmove', onTouchMove, { passive: false });
    element.addEventListener('touchend', onTouchEnd);
    element.addEventListener('touchcancel', onTouchEnd);
    element.addEventListener('gesturestart', stopGesture);
    return () => {
      element.removeEventListener('wheel', onWheel);
      element.removeEventListener('touchstart', onTouchStart);
      element.removeEventListener('touchmove', onTouchMove);
      element.removeEventListener('touchend', onTouchEnd);
      element.removeEventListener('touchcancel', onTouchEnd);
      element.removeEventListener('gesturestart', stopGesture);
    };
  }, [zoomTo]);

  // Dragging empty table space with the mouse pans. Touch already pans by scrolling.
  const dragRef = useRef<{ x: number; y: number; left: number; top: number }>(undefined);
  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    const element = viewportRef.current;
    if (!element || event.pointerType !== 'mouse' || event.button !== 0) return;
    if ((event.target as HTMLElement).closest('.table-card')) return;
    event.preventDefault();
    dragRef.current = { x: event.clientX, y: event.clientY, left: element.scrollLeft, top: element.scrollTop };
    element.setPointerCapture?.(event.pointerId);
    element.classList.add('table-viewport--panning');
  }
  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const element = viewportRef.current;
    const drag = dragRef.current;
    if (!element || !drag) return;
    element.scrollLeft = drag.left - (event.clientX - drag.x);
    element.scrollTop = drag.top - (event.clientY - drag.y);
  }
  function endDrag() {
    dragRef.current = undefined;
    viewportRef.current?.classList.remove('table-viewport--panning');
  }

  // Shift+arrow keys pan; plain arrows move between cards.
  function onViewportKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const direction = ARROWS[event.key];
    const element = viewportRef.current;
    if (!direction || !element || !event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    if (direction === 'left' || direction === 'right') element.scrollLeft += direction === 'left' ? -PAN_STEP : PAN_STEP;
    else element.scrollTop += direction === 'up' ? -PAN_STEP : PAN_STEP;
  }

  // Move focus once the change has rendered: a card that was re-ordered or added, or what's left.
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = undefined;
    if (target === 'none') return;
    if (target === 'toast') document.getElementById(TOAST_UNDO_ID)?.focus();
    else if (target === 'table') surfaceRef.current?.focus();
    else buttons.current[target.card]?.focus();
  });

  /** The card that takes a leaving card's place: the next in reading order, else the one before. */
  const neighbourOf = (cardId: string) => {
    const order = readingOrder(game.table);
    const index = order.indexOf(cardId);
    return order[index + 1] ?? order[index - 1];
  };

  function openMenu(cardId: string) {
    const rect = buttons.current[cardId]?.getBoundingClientRect();
    if (rect) setMenu((open) => (open?.cardId === cardId ? undefined : { cardId, rect }));
  }

  function closeMenu() {
    // An action may already have said where focus goes; otherwise it returns to the card.
    if (menu && !pendingFocus.current) pendingFocus.current = { card: menu.cardId };
    setMenu(undefined);
  }

  /** TT-5, TT-6, TT-10, TT-11 and SP-8: one card command, from the menu or a key. */
  function runCommand(cardId: string, command: CardCommand) {
    switch (command) {
      case 'rotate':
      case 'rotate-back':
        dispatch((g) => rotate(g, { cardId, direction: command === 'rotate' ? 'clockwise' : 'counter-clockwise' }));
        break;
      case 'flip':
        dispatch((g) => flip(g, { cardId }));
        break;
      case 'front':
        dispatch((g) => bringToFront(g, { cardId }));
        break;
      case 'back':
        dispatch((g) => sendToBack(g, { cardId }));
        break;
      case 'duplicate': {
        const result = dispatch((g, context) => duplicate(g, { cardId }, context));
        pendingFocus.current = { card: result.cardId };
        return;
      }
      case 'delete': {
        const next = neighbourOf(cardId);
        const name = shownName(game, cardId);
        dispatch((g) => deleteCard(g, { cardId }));
        showToast(`Deleted ${name}.`);
        pendingFocus.current = next ? { card: next } : 'toast';
        return;
      }
      case 'move': {
        const entry = game.table.find((e) => e.cardId === cardId);
        if (!entry) return;
        // A face-down card stays hidden in the dialog too.
        const face = tableCardView(game, entry).face ?? { name: 'Face-down card', fields: {} };
        setMoveRequest({ cardId, face, fromName: 'the table', options: moveDestinations(game, cardId) });
        pendingFocus.current = 'none';
        return;
      }
      case 'details':
        setDetailsCardId(cardId);
        pendingFocus.current = 'none';
        return;
    }
    // Re-ordering moves the card's element, which can drop focus, so put it back.
    pendingFocus.current = { card: cardId };
  }

  /** The card a move took off the table leaves focus to its neighbour. */
  const afterMove = useRef<string>(undefined);

  function confirmMove(to: Destination) {
    if (!moveRequest) return;
    const { cardId } = moveRequest;
    afterMove.current = neighbourOf(cardId) ?? '';
    dispatch((g, context) => moveCard(g, { cardId, to }, context));
  }

  /** Puts focus back after a dialog: on the card if it's still here, else where the move left it. */
  function focusAfterDialog(cardId: string | undefined) {
    // The dialog closes before a move has re-rendered, and its close puts focus back
    // where it was first, so decide once both are done.
    window.setTimeout(() => {
      const next = afterMove.current;
      afterMove.current = undefined;
      const stayed = cardId ? buttons.current[cardId] : undefined;
      const element = stayed?.isConnected ? stayed : next ? buttons.current[next] : undefined;
      (element?.isConnected ? element : surfaceRef.current)?.focus();
    });
  }

  function closeMove() {
    focusAfterDialog(moveRequest?.cardId);
    setMoveRequest(undefined);
  }

  function closeDetails() {
    focusAfterDialog(detailsCardId);
    setDetailsCardId(undefined);
  }

  // Card keys only work while a card has focus, so single keys are safe (WCAG 2.1.4).
  const CARD_KEYS: Record<string, CardCommand> = { r: 'rotate', R: 'rotate-back', f: 'flip', m: 'move', Delete: 'delete', Backspace: 'delete' };

  function onCardKeyDown(cardId: string, event: KeyboardEvent<HTMLButtonElement>) {
    const { key } = event;
    if (event.altKey) return;
    if (event.ctrlKey || event.metaKey) {
      if (key.toLowerCase() === 'd' && !event.shiftKey) {
        event.preventDefault();
        runCommand(cardId, 'duplicate');
      }
      return;
    }
    if (key === 'Enter' || key === 'ContextMenu' || (key === 'F10' && event.shiftKey)) {
      event.preventDefault();
      openMenu(cardId);
      return;
    }
    const cardCommand = CARD_KEYS[key];
    if (cardCommand) {
      event.preventDefault();
      runCommand(cardId, cardCommand);
      return;
    }
    const direction = ARROWS[key];
    if (!direction || event.shiftKey) return;
    event.preventDefault();
    const next = nearestInDirection(game.table, cardId, direction);
    if (next) buttons.current[next]?.focus();
  }

  const count = game.table.length;
  const label = `Table, ${count} ${count === 1 ? 'card' : 'cards'}`;
  // The Tab stop is the last card focused, or the first in reading order once that card has gone.
  const tabbableId = activeId && game.table.some((e) => e.cardId === activeId) ? activeId : readingOrder(game.table)[0];
  // The mat reaches past the last card, so there's room to pan and drop, and always fills the view.
  const boxes = game.table.map(cardBox);
  const width = Math.max(size.width / zoom, ...boxes.map((b) => b.right + 2 * CARD_W));
  const height = Math.max(size.height / zoom, ...boxes.map((b) => b.bottom + CARD_H));

  return (
    <>
      {/* The viewport only hears pointer and key events from inside it; the cards are the controls.
          Firefox makes any scrolling box a Tab stop, which would give the table two (A11Y-3). */}
      <div
        ref={viewportRef}
        className="table-viewport"
        role="presentation"
        tabIndex={-1}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onViewportKeyDown}
      >
        <div className="table-viewport__sizer" style={{ width: width * zoom, height: height * zoom }}>
          <div
            ref={surfaceRef}
            // Focusable from code only, for when the last card has gone.
            tabIndex={-1}
            className={snap ? 'table-surface table-surface--grid' : 'table-surface'}
            role="group"
            aria-label={count === 0 ? label : `${label}. Arrow keys move between cards. Shift and arrow keys pan.`}
            style={{ width, height, transform: zoom === 1 ? undefined : `scale(${zoom})` }}
          >
            {count === 0 && <p className="table-surface__empty">No cards on the table yet.</p>}
            {game.table.map((entry, index) => (
              <TableCard
                key={entry.cardId}
                view={tableCardView(game, entry)}
                layer={index + 1}
                tabbable={entry.cardId === tabbableId}
                register={register}
                onFocus={setActiveId}
                onKeyDown={onCardKeyDown}
                menuOpen={menu?.cardId === entry.cardId}
                onOpenMenu={openMenu}
              />
            ))}
          </div>
        </div>
      </div>
      {/* The menu sits outside the zoomed mat, so it's the same size at any zoom. */}
      {menu && game.table.some((e) => e.cardId === menu.cardId) && (
        <div className="card-menu-anchor" style={{ left: menu.rect.left, top: menu.rect.top, width: menu.rect.width, height: menu.rect.height }}>
          <CardMenu game={game} cardId={menu.cardId} onCommand={(command) => runCommand(menu.cardId, command)} onClose={closeMenu} />
        </div>
      )}
      <MoveDialog key={moveRequest?.cardId ?? 'closed'} request={moveRequest} onConfirm={confirmMove} onClose={closeMove} />
      <CardDetailsDialog game={game} cardId={detailsCardId} onClose={closeDetails} />
    </>
  );
}
