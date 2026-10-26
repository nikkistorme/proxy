import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { cardBox, CARD_H, CARD_W } from '../model/tablePlacement';
import { nearestInDirection, readingOrder, type Direction } from '../model/tableNavigation';
import { clampZoom, fitAll, MAX_ZOOM, scrollAfterZoom, stepZoom, zoomPercent, type Scroll } from '../model/tableView';
import { useGameStore } from '../store/gameStore';
import { TableCard } from './TableCard';
import { tableCardView } from './tableCardView';
import './TableSurface.css';

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

  const [activeId, setActiveId] = useState<string>();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);
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

  const onCardKeyDown = useCallback(
    (cardId: string, event: KeyboardEvent<HTMLButtonElement>) => {
      const direction = ARROWS[event.key];
      if (!direction || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      event.preventDefault();
      const next = nearestInDirection(game.table, cardId, direction);
      if (next) buttons.current[next]?.focus();
    },
    [game.table],
  );

  const count = game.table.length;
  const label = `Table, ${count} ${count === 1 ? 'card' : 'cards'}`;
  // The Tab stop is the last card focused, or the first in reading order once that card has gone.
  const tabbableId = activeId && game.table.some((e) => e.cardId === activeId) ? activeId : readingOrder(game.table)[0];
  // The mat reaches past the last card, so there's room to pan and drop, and always fills the view.
  const boxes = game.table.map(cardBox);
  const width = Math.max(size.width / zoom, ...boxes.map((b) => b.right + 2 * CARD_W));
  const height = Math.max(size.height / zoom, ...boxes.map((b) => b.bottom + CARD_H));

  return (
    // The viewport only hears pointer and key events from inside it; the cards are the controls.
    <div
      ref={viewportRef}
      className="table-viewport"
      role="presentation"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onViewportKeyDown}
    >
      <div className="table-viewport__sizer" style={{ width: width * zoom, height: height * zoom }}>
        <div
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
            />
          ))}
        </div>
      </div>
    </div>
  );
}
