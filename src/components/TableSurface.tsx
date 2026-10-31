import { flushSync } from 'react-dom';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import { cardBox, CARD_H, CARD_W, clampToTable, columnsFor, describeSpot, freeSpot, overlaps, pileBox, pileUnder, TABLE_GAP } from '../model/tablePlacement';
import { nearestInDirection, readingOrder, tableItems, type Direction } from '../model/tableNavigation';
import { clampZoom, fitAll, GRID_X, GRID_Y, MAX_ZOOM, scrollAfterZoom, snapToGrid, stepZoom, zoomPercent, type Scroll } from '../model/tableView';
import { bringToFront, deleteCard, duplicate, flip, rotate, sendToBack, shownName } from '../actions/cardActions';
import { cardName } from '../actions/helpers';
import { moveCard, type Destination } from '../actions/moveCard';
import { movePile } from '../actions/piles';
import type { SessionState, Pile, Rotation } from '../model/session';
import { useSessionStore, type Placing } from '../store/sessionStore';
import { useCardDrag } from './cardDrag';
import { CardDetailsDialog } from './CardDetailsDialog';
import { CardEnlarge } from './CardEnlarge';
import { CardMenu, type CardCommand } from './CardMenu';
import { CountersDialog, type CountersRequest } from './CountersDialog';
import type { Box } from './enlargePlacement';
import { moveDestinations } from './moveDestinations';
import { MoveDialog, type MoveRequest } from './MoveDialog';
import { PlacementBar } from './PlacementBar';
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
/** How far a click can wander and still count as a click, not a pan, in screen px. */
const CLICK_SLOP = 5;
/** TT-9: how long the mouse rests on a card before it's enlarged. */
export const ENLARGE_HOVER_MS = 400;
/** How long the pointer can be off both the card and its preview before the preview closes. */
const ENLARGE_LEAVE_MS = 150;

/** The card or pile being placed and where its outline is (A11Y-1). */
interface Placement {
  /** The card's or pile's id. */
  id: string;
  pile: boolean;
  x: number;
  y: number;
  rotation: Rotation;
}

/** What the table gives each pile it draws, so the pile joins the table's one Tab stop (A11Y-3). */
export interface PileSlot {
  tabbable: boolean;
  register: (element: HTMLButtonElement | null) => void;
  onFocus: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  onKeyUp: (event: KeyboardEvent<HTMLButtonElement>) => void;
  /** TT-4: a pile being dragged or placed is over this one, and would merge with it. */
  mergeTarget: boolean;
}

const plural = (count: number, word: string) => `${count} ${count === 1 ? word : `${word}s`}`;

/** The name a card being placed goes by: as it shows on the table, or as its owner sees it in the hand. */
function placingName(session: SessionState, cardId: string): string {
  if (session.table.some((e) => e.cardId === cardId)) return shownName(session, cardId);
  const name = shownName(session, cardId);
  return name === 'a face-down card' ? cardName(session, cardId) : name;
}

/** Whether a card can still be placed: it's on the table or in a hand. */
function placeable(session: SessionState, cardId: string): boolean {
  return session.table.some((e) => e.cardId === cardId) || Object.values(session.hands).some((hand) => hand.includes(cardId));
}

/** The card or pile being placed, while it can still be: an undo can take it away. */
function placingId(session: SessionState, placing: Placing | undefined): string | undefined {
  if (!placing) return undefined;
  if ('pileId' in placing) return session.piles.some((p) => p.id === placing.pileId) ? placing.pileId : undefined;
  return placeable(session, placing.cardId) ? placing.cardId : undefined;
}

function placementName(session: SessionState, placement: Placement): string {
  return placement.pile ? (session.piles.find((p) => p.id === placement.id)?.name ?? '') : placingName(session, placement.id);
}

interface TableSurfaceProps {
  /** Draws a pile on the table. The session screen owns piles' menus and dialogs, so it draws them. */
  renderPile?: (pile: Pile, slot: PileSlot) => ReactNode;
  /** A finger held a pile and let go without moving it. */
  openPileMenu?: (pileId: string) => void;
  /** TT-4: a pile was dropped or placed on another pile. The session screen asks how to merge them. */
  requestMerge?: (pileId: string, otherPileId: string) => void;
}

/**
 * The free-form table. Cards and piles sit at their positions on a mat that pans
 * and zooms (TT-1) inside its own viewport. The table is one Tab stop, and arrow
 * keys move focus to the nearest card or pile in that direction (A11Y-3).
 */
export function TableSurface({ renderPile, openPileMenu, requestMerge }: TableSurfaceProps = {}) {
  const session = useSessionStore((s) => s.session);
  const { zoom, snap } = useSessionStore((s) => s.view);
  const setView = useSessionStore((s) => s.setView);
  const announce = useSessionStore((s) => s.announce);
  const setTableViewport = useSessionStore((s) => s.setTableViewport);

  const dispatch = useSessionStore((s) => s.dispatch);
  const showToast = useSessionStore((s) => s.showToast);
  const dismissToast = useSessionStore((s) => s.dismissToast);
  const placing = useSessionStore((s) => s.placing);
  const setPlacing = useSessionStore((s) => s.setPlacing);
  const columnsInView = useSessionStore((s) => s.view.columns);
  const drag = useSessionStore((s) => s.drag);
  const startDrag = useCardDrag();

  const [activeId, setActiveId] = useState<string>();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [menu, setMenu] = useState<{ cardId: string; rect: DOMRect }>();
  const [moveRequest, setMoveRequest] = useState<MoveRequest>();
  const [detailsCardId, setDetailsCardId] = useState<string>();
  const [countersRequest, setCountersRequest] = useState<CountersRequest>();
  /** TT-9: the enlarged card. A key or the menu moves focus into it; a hover doesn't. */
  const [enlarge, setEnlarge] = useState<{ cardId: string; anchor: Box; takeFocus: boolean; zoom: number }>();
  const hoverTimer = useRef<number>(undefined);
  const leaveTimer = useRef<number>(undefined);
  const [placement, setPlacement] = useState<Placement>();
  const placementRef = useRef<HTMLButtonElement>(null);
  /** Where the last pointer went down, so a pan isn't taken for a click. */
  const pointerDownAt = useRef<{ x: number; y: number }>(undefined);
  /** The latest session and outline, for effects that only run when placing starts. */
  const latest = useRef({ session, placement });
  useLayoutEffect(() => {
    latest.current = { session, placement };
  });
  const pendingFocus = useRef<FocusTarget>(undefined);
  const viewportRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({});
  /** Scroll to apply once the new zoom has rendered. */
  const pendingScroll = useRef<Scroll>(undefined);
  // The latest zoom and cards, for handlers registered once.
  const zoomRef = useRef(zoom);
  // Piles are on the table only when something draws them.
  const piles = renderPile ? session.piles : [];
  const tableRef = useRef(session.table);
  const pilesRef = useRef(piles);
  useLayoutEffect(() => {
    zoomRef.current = zoom;
    tableRef.current = session.table;
    pilesRef.current = piles;
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
        const shownPiles = pilesRef.current;
        const boxes = [...table.map(cardBox), ...shownPiles.map(pileBox)];
        const fit = element && fitAll(boxes, { width: element.clientWidth, height: element.clientHeight });
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
        const what = shownPiles.length === 0 ? plural(table.length, 'card') : `${plural(table.length, 'card')} and ${plural(shownPiles.length, 'pile')}`;
        announce(`Showing all ${what} at ${zoomPercent(fit.zoom)}.`);
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
    if ((event.target as HTMLElement).closest('.table-card, .table-pile')) return;
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

  // A11Y-3: arrow keys move between cards and piles alike.
  const items = tableItems({ table: session.table, piles });

  /** The card or pile that takes a leaving card's place: the next in reading order, else the one before. */
  const neighbourOf = (cardId: string) => {
    const order = readingOrder(items);
    const index = order.indexOf(cardId);
    return order[index + 1] ?? order[index - 1];
  };

  function openMenu(cardId: string) {
    window.clearTimeout(hoverTimer.current);
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
        const name = shownName(session, cardId);
        dispatch((g) => deleteCard(g, { cardId }));
        showToast(`Deleted ${name}.`);
        pendingFocus.current = next ? { card: next } : 'toast';
        return;
      }
      case 'move': {
        const entry = session.table.find((e) => e.cardId === cardId);
        if (!entry) return;
        // A face-down card stays hidden in the dialog too.
        const face = tableCardView(session, entry).face ?? { name: 'Face-down card', fields: {} };
        setMoveRequest({ cardId, face, fromName: 'the table', options: moveDestinations(session, cardId) });
        pendingFocus.current = 'none';
        return;
      }
      case 'counters':
        openCounters(cardId);
        return;
      case 'enlarge':
        if (enlarge?.cardId === cardId) closeEnlarge(true);
        else openEnlarge(cardId, true);
        return;
      case 'details':
        setDetailsCardId(cardId);
        pendingFocus.current = 'none';
        return;
      case 'place':
        setPlacing({ cardId });
        pendingFocus.current = 'none';
        return;
    }
    // Re-ordering moves the card's element, which can drop focus, so put it back.
    pendingFocus.current = { card: cardId };
  }

  /** TT-9: shows a card at full size beside it. A face-down card keeps its secret. */
  function openEnlarge(cardId: string, takeFocus: boolean) {
    window.clearTimeout(hoverTimer.current);
    window.clearTimeout(leaveTimer.current);
    // A face-down card shows its front when asked by key or menu, a quick look at
    // what it is (owner decision), but never on a passing hover.
    if (session.cards[cardId]?.side === 'down' && !takeFocus) return;
    const rect = buttons.current[cardId]?.closest('.table-card')?.getBoundingClientRect();
    if (!rect) return;
    setMenu(undefined);
    setEnlarge({ cardId, anchor: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }, takeFocus, zoom });
    if (takeFocus) pendingFocus.current = 'none';
  }

  /** Closes the preview. Focus goes back to the card only if the preview had it and it isn't going elsewhere. */
  function closeEnlarge(refocus: boolean) {
    window.clearTimeout(hoverTimer.current);
    window.clearTimeout(leaveTimer.current);
    if (refocus && enlarge?.takeFocus) buttons.current[enlarge.cardId]?.focus();
    setEnlarge(undefined);
  }

  /** TT-9: a mouse resting on a card enlarges it after a moment; leaving it and its preview closes it. */
  function onCardHover(cardId: string, entering: boolean) {
    window.clearTimeout(hoverTimer.current);
    if (entering) {
      if (drag || menu || enlarge?.takeFocus) return;
      window.clearTimeout(leaveTimer.current);
      if (enlarge?.cardId === cardId) return;
      hoverTimer.current = window.setTimeout(() => openEnlarge(cardId, false), ENLARGE_HOVER_MS);
    } else if (enlarge && !enlarge.takeFocus) {
      leaveTimer.current = window.setTimeout(() => setEnlarge(undefined), ENLARGE_LEAVE_MS);
    }
  }

  // A press anywhere but the preview, or the table scrolling or zooming under it, closes it.
  useEffect(() => {
    if (!enlarge) return;
    const viewport = viewportRef.current;
    const onPress = (event: Event) => {
      if (!(event.target instanceof Element && event.target.closest('.card-enlarge'))) setEnlarge(undefined);
    };
    const onScroll = () => setEnlarge(undefined);
    window.addEventListener('pointerdown', onPress, true);
    viewport?.addEventListener('scroll', onScroll);
    return () => {
      window.removeEventListener('pointerdown', onPress, true);
      viewport?.removeEventListener('scroll', onScroll);
    };
  }, [enlarge]);
  useEffect(
    () => () => {
      window.clearTimeout(hoverTimer.current);
      window.clearTimeout(leaveTimer.current);
    },
    [],
  );

  /** TT-8: the card's counters, at one counter when its pill was pressed. */
  function openCounters(cardId: string, counterId?: string) {
    setMenu(undefined);
    setCountersRequest({ cardId, ...(counterId && { counterId }) });
    pendingFocus.current = 'none';
  }

  /** Set when the Move to… dialog closes by choosing a spot, which starts placing. */
  const choseSpot = useRef(false);

  function chooseSpot() {
    if (!moveRequest) return;
    choseSpot.current = true;
    setPlacing({ cardId: moveRequest.cardId });
  }

  /** The card a move took off the table leaves focus to its neighbour. */
  const afterMove = useRef<string>(undefined);

  function confirmMove(to: Destination) {
    if (!moveRequest) return;
    const { cardId } = moveRequest;
    afterMove.current = neighbourOf(cardId) ?? '';
    // Rendered before the dialog reports closing, so focus can go to the card that's left.
    flushSync(() => dispatch((g, context) => moveCard(g, { cardId, to }, context)));
  }

  /** Puts focus back after a dialog: on the card if it's still here, else where the move left it. */
  function focusAfterDialog(cardId: string | undefined) {
    // Called from the dialog's close event, a task after the click or key that confirmed, so
    // the move has rendered, and the browser has already put focus back on the opener.
    const next = afterMove.current;
    afterMove.current = undefined;
    const stayed = cardId ? buttons.current[cardId] : undefined;
    const element = stayed?.isConnected ? stayed : next ? buttons.current[next] : undefined;
    (element?.isConnected ? element : surfaceRef.current)?.focus();
  }

  function closeMove() {
    // Placing puts focus on the outline instead.
    if (!choseSpot.current) focusAfterDialog(moveRequest?.cardId);
    choseSpot.current = false;
    setMoveRequest(undefined);
  }

  function closeDetails() {
    focusAfterDialog(detailsCardId);
    setDetailsCardId(undefined);
  }

  function closeCounters() {
    focusAfterDialog(countersRequest?.cardId);
    setCountersRequest(undefined);
  }

  // A11Y-1: placing starts when the store names a card or pile, from here, the hand, a pile's
  // menu or the Move to… dialog. The outline starts where the card or pile is, or at the next
  // free spot for a card coming from the hand.
  const placedId = placingId(session, placing);
  if (placedId !== placement?.id) {
    const pile = session.piles.find((p) => p.id === placedId);
    const entry = session.table.find((e) => e.cardId === placedId);
    const start = pile ? { x: pile.x, y: pile.y, rotation: 0 as Rotation } : (entry ?? { ...freeSpot(session, columnsInView), rotation: 0 as Rotation });
    setPlacement(placedId ? { id: placedId, pile: pile !== undefined, x: start.x, y: start.y, rotation: start.rotation } : undefined);
    if (placedId) setMenu(undefined);
  }

  // An undo can take away the card or pile being placed.
  useEffect(() => {
    if (placing && !placingId(session, placing)) setPlacing(undefined);
  }, [placing, session, setPlacing]);

  const startedId = placement?.id;
  useEffect(() => {
    if (!startedId) return;
    const { session: current } = latest.current;
    const spot = latest.current.placement;
    dismissToast();
    if (spot) announce(`Picked up ${placementName(current, spot)}. ${describeSpot(spot)}. Arrow keys move it, Enter places it, Escape cancels.`);
    // Any dialog that started it has closed and put focus back by now.
    placementRef.current?.focus();
  }, [startedId, dismissToast, announce]);

  // Keep the outline in view as it moves.
  useEffect(() => {
    if (placement) placementRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [placement]);

  /** Moves the outline to `to`, snapped if snap is on and kept inside the table's edges, and says where it is. */
  function moveOutline(to: { x: number; y: number }) {
    if (!placement) return;
    const spot = clampToTable(snap ? snapToGrid(to) : to, placement.rotation);
    setPlacement({ ...placement, ...spot });
    const box = cardBox({ ...spot, rotation: placement.rotation });
    // A pile over another pile merges with it, so say which.
    const mergeWith = placement.pile ? pileUnder(piles, box, placement.id) : undefined;
    if (mergeWith) {
      announce(`${describeSpot(spot)}, over ${mergeWith.name}. Enter merges them.`);
      return;
    }
    // The topmost card under the outline, then any pile.
    const under = [
      ...[...session.table].reverse().filter((e) => e.cardId !== placement.id && overlaps(cardBox(e), box)).map((e) => shownName(session, e.cardId)),
      ...piles.filter((p) => p.id !== placement.id && overlaps(pileBox(p), box)).map((p) => p.name),
    ];
    const over = under[0] ? `, over ${under[0]}${under.length > 1 ? ` and ${under.length - 1} more` : ''}` : '';
    announce(`${describeSpot(spot)}${over}.`);
  }

  function placeCard() {
    if (!placement) return;
    const { id, x, y } = placement;
    const mergeWith = placement.pile ? pileUnder(piles, pileBox({ x, y }), id) : undefined;
    if (mergeWith) {
      // Piles never overlap: the dialog asks how to merge them, and Cancel leaves the pile where it was.
      setPlacing(undefined);
      pendingFocus.current = 'none';
      requestMerge?.(id, mergeWith.id);
      return;
    }
    if (placement.pile) dispatch((g) => movePile(g, { pileId: id, position: { x, y } }));
    else dispatch((g, context) => moveCard(g, { cardId: id, to: { zone: 'table', position: { x, y } } }, context));
    pendingFocus.current = { card: id };
    setPlacing(undefined);
  }

  function cancelPlacing() {
    if (!placement || !placing) return;
    announce(`Put ${placementName(session, placement)} back.`);
    if (placement.pile || session.table.some((e) => e.cardId === placement.id)) pendingFocus.current = { card: placement.id };
    else if ('returnFocus' in placing) placing.returnFocus?.();
    setPlacing(undefined);
  }

  function onPlacementKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!placement || event.altKey || event.ctrlKey || event.metaKey) return;
    const direction = ARROWS[event.key];
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelPlacing();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      placeCard();
    } else if (event.key === ' ') {
      // Placed on keyup, so the same press doesn't pick the card up again from the card.
      event.preventDefault();
    } else if (direction) {
      event.preventDefault();
      // One grid step with snap on; otherwise a nudge, or a whole card with Shift.
      const across = snap ? GRID_X * (event.shiftKey ? 2 : 1) : event.shiftKey ? CARD_W + TABLE_GAP : TABLE_GAP;
      const down = snap ? GRID_Y * (event.shiftKey ? 2 : 1) : event.shiftKey ? CARD_H + TABLE_GAP : TABLE_GAP;
      const dx = direction === 'left' ? -across : direction === 'right' ? across : 0;
      const dy = direction === 'up' ? -down : direction === 'down' ? down : 0;
      moveOutline({ x: placement.x + dx, y: placement.y + dy });
    }
  }

  // While placing, a click or tap anywhere on the table moves the outline there, centred on the pointer.
  function onTableClickCapture(event: MouseEvent<HTMLDivElement>) {
    const surface = surfaceRef.current;
    if (!placement || !surface) return;
    event.preventDefault();
    event.stopPropagation();
    const down = pointerDownAt.current;
    if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > CLICK_SLOP) return;
    // A click from the keyboard or a screen reader on the outline places the card.
    if (event.detail === 0) {
      if (placementRef.current?.contains(event.target as Node)) placeCard();
      return;
    }
    const rect = surface.getBoundingClientRect();
    const x = (event.clientX - rect.left) / zoom - CARD_W / 2;
    const y = (event.clientY - rect.top) / zoom - CARD_H / 2;
    moveOutline({ x, y });
    placementRef.current?.focus();
  }

  // TT-4: dragging a card moves it on the table, or to a pile or a hand, through the same action as a keyboard move.
  function onCardPointerDown(cardId: string, event: PointerEvent<HTMLButtonElement>) {
    // A press means the pointer is busy with the card, so a waiting hover preview doesn't open.
    window.clearTimeout(hoverTimer.current);
    const entry = session.table.find((e) => e.cardId === cardId);
    const visual = event.currentTarget.closest<HTMLElement>('.table-card');
    if (!entry || !visual) return;
    const name = shownName(session, cardId);
    startDrag(event, {
      cardId,
      name,
      visual,
      scale: zoom,
      rotation: entry.rotation,
      from: { zone: 'table', position: { x: entry.x, y: entry.y } },
      drop: (to) => {
        if (to.zone === 'table') pendingFocus.current = { card: cardId };
        else {
          const next = neighbourOf(cardId);
          pendingFocus.current = next ? { card: next } : 'table';
        }
        dispatch((g, context) => moveCard(g, { cardId, to }, context));
      },
      cancel: () => {
        announce(`Put ${name} back.`);
        pendingFocus.current = { card: cardId };
      },
      // Like a pile: a held finger let go in place opens the card's menu.
      onHoldRelease: () => {
        buttons.current[cardId]?.focus();
        openMenu(cardId);
      },
    });
  }

  // TT-4: dragging a pile moves it on the table. A held finger let go without moving opens its menu.
  function onPilePointerDown(pileId: string, event: PointerEvent<HTMLDivElement>) {
    const pile = piles.find((p) => p.id === pileId);
    if (!pile) return;
    startDrag(event, {
      pileId,
      name: pile.name,
      visual: event.currentTarget,
      scale: zoom,
      rotation: 0,
      from: { zone: 'table', position: { x: pile.x, y: pile.y } },
      drop: (to) => {
        if (to.zone === 'pile') {
          pendingFocus.current = 'none';
          requestMerge?.(pileId, to.pileId);
          return;
        }
        if (to.zone !== 'table' || !to.position) return;
        pendingFocus.current = { card: pileId };
        dispatch((g) => movePile(g, { pileId, position: to.position ?? pile }));
      },
      cancel: () => {
        announce(`Put ${pile.name} back.`);
        pendingFocus.current = { card: pileId };
      },
      onHoldRelease: () => {
        buttons.current[pileId]?.focus();
        openPileMenu?.(pileId);
      },
    });
  }

  // Card keys only work while a card has focus, so single keys are safe (WCAG 2.1.4).
  const CARD_KEYS: Record<string, CardCommand> = { r: 'rotate', R: 'rotate-back', f: 'flip', m: 'move', c: 'counters', i: 'enlarge', I: 'enlarge', Delete: 'delete', Backspace: 'delete' };

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
    if (key === 'Escape') {
      event.preventDefault();
      // Escape closes the preview first; otherwise it steps back from the card to the table.
      if (enlarge) closeEnlarge(true);
      else surfaceRef.current?.focus();
      return;
    }
    if (key === ' ') {
      // Picked up on keyup, so the Space press doesn't also click the outline.
      event.preventDefault();
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
    const next = nearestInDirection(items, cardId, direction);
    if (next) buttons.current[next]?.focus();
  }

  // On a pile, plain arrows move between cards and piles, and Space picks it up; its other keys are the pile's own.
  function onPileKeyDown(pileId: string, event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Escape' && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
      // Steps back from the pile to the table, as on a card.
      event.preventDefault();
      surfaceRef.current?.focus();
      return;
    }
    if (event.key === ' ' && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
      // Picked up on keyup; without this, Space would click the pile and draw.
      event.preventDefault();
      return;
    }
    const direction = ARROWS[event.key];
    if (!direction || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    const next = nearestInDirection(items, pileId, direction);
    if (next) buttons.current[next]?.focus();
  }

  function onPileKeyUp(pileId: string, event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== ' ' || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    setPlacing({ pileId });
    pendingFocus.current = 'none';
  }

  function onCardKeyUp(cardId: string, event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== ' ' || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    runCommand(cardId, 'place');
  }

  const count = session.table.length;
  const label = `Table, ${plural(count, 'card')}${renderPile ? `, ${plural(piles.length, 'pile')}` : ''}`;
  // The Tab stop is the last card focused, or the first in reading order once that card has gone.
  const tabbableId = activeId && items.some((item) => item.id === activeId) ? activeId : readingOrder(items)[0];
  // The mat reaches past the last card, so there's room to pan and drop, and always fills the view.
  const outline = placement && cardBox(placement);
  // Where a dragged card would land, turned as it is now.
  const dropAt = drag?.over?.zone === 'table' ? drag.over.position : undefined;
  // TT-4: the pile a dragged or placed pile would merge with.
  const mergeTargetId =
    drag?.pileId !== undefined && drag.over?.zone === 'pile'
      ? drag.over.pileId
      : placement?.pile
        ? pileUnder(piles, pileBox(placement), placement.id)?.id
        : undefined;
  const dropBox = dropAt && cardBox({ ...dropAt, rotation: session.table.find((e) => e.cardId === drag?.cardId)?.rotation ?? 0 });
  const boxes = [...session.table.map(cardBox), ...piles.map(pileBox), ...(outline ? [outline] : []), ...(dropBox ? [dropBox] : [])];
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
        onPointerDownCapture={(event) => {
          pointerDownAt.current = { x: event.clientX, y: event.clientY };
        }}
        // A mouse press on empty space captures the pointer to pan, so its click lands here, not on the mat.
        onClickCapture={onTableClickCapture}
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
            data-drop-zone="table"
            role="group"
            aria-label={items.length === 0 ? label : `${label}. Arrow keys move between ${renderPile ? 'cards and piles' : 'cards'}. Shift and arrow keys pan.`}
            style={{ width, height, transform: zoom === 1 ? undefined : `scale(${zoom})` }}
          >
            {items.length === 0 && <p className="table-surface__empty">No cards on the table yet.</p>}
            {/* Under the cards, so a card put on a pile shows on top of it. */}
            {renderPile &&
              piles.map((pile) => (
                <TablePile
                  key={pile.id}
                  pile={pile}
                  render={renderPile}
                  tabbable={pile.id === tabbableId}
                  register={(element) => register(pile.id, element)}
                  onFocus={() => setActiveId(pile.id)}
                  onKeyDown={(event) => onPileKeyDown(pile.id, event)}
                  onKeyUp={(event) => onPileKeyUp(pile.id, event)}
                  onPointerDown={(event) => onPilePointerDown(pile.id, event)}
                  dragging={drag?.pileId === pile.id}
                  mergeTarget={pile.id === mergeTargetId}
                />
              ))}
            {session.table.map((entry, index) => (
              <TableCard
                key={entry.cardId}
                view={tableCardView(session, entry)}
                layer={index + 1}
                tabbable={entry.cardId === tabbableId}
                register={register}
                onFocus={setActiveId}
                onKeyDown={onCardKeyDown}
                onKeyUp={onCardKeyUp}
                menuOpen={menu?.cardId === entry.cardId}
                onOpenMenu={openMenu}
                onPointerDown={onCardPointerDown}
                dragging={drag?.cardId === entry.cardId}
                onOpenCounters={openCounters}
                onHover={onCardHover}
              />
            ))}
            {dropBox && (
              <div
                className="table-placement table-drop"
                aria-hidden="true"
                style={{ left: dropBox.left, top: dropBox.top, width: dropBox.right - dropBox.left, height: dropBox.bottom - dropBox.top }}
              />
            )}
            {placement && outline && (
              // Last in the mat, so Tab goes from it to the bar's Place and Cancel.
              <button
                ref={placementRef}
                type="button"
                className="table-placement"
                style={{ left: outline.left, top: outline.top, width: outline.right - outline.left, height: outline.bottom - outline.top }}
                aria-label={`Placing ${placementName(session, placement)}, ${describeSpot(placement)}. Arrow keys move, Enter places, Escape cancels.`}
                onKeyDown={onPlacementKeyDown}
                onKeyUp={(event) => {
                  if (event.key !== ' ' || event.altKey || event.ctrlKey || event.metaKey) return;
                  event.preventDefault();
                  placeCard();
                }}
              >
                <span aria-hidden="true">{placementName(session, placement)}</span>
              </button>
            )}
          </div>
        </div>
      </div>
      {/* The menu sits outside the zoomed mat, so it's the same size at any zoom. */}
      {menu && session.table.some((e) => e.cardId === menu.cardId) && (
        <div className="card-menu-anchor" style={{ left: menu.rect.left, top: menu.rect.top, width: menu.rect.width, height: menu.rect.height }}>
          <CardMenu session={session} cardId={menu.cardId} onCommand={(command) => runCommand(menu.cardId, command)} onClose={closeMenu} />
        </div>
      )}
      <MoveDialog key={moveRequest?.cardId ?? 'closed'} request={moveRequest} onConfirm={confirmMove} onChooseSpot={chooseSpot} onClose={closeMove} />
      <CardDetailsDialog session={session} cardId={detailsCardId} onClose={closeDetails} />
      {/* Zooming moves the card, so a preview from before the zoom is dropped. */}
      {enlarge && enlarge.zoom === zoom && session.table.some((e) => e.cardId === enlarge.cardId) && (
        <CardEnlarge
          key={enlarge.cardId}
          session={session}
          cardId={enlarge.cardId}
          anchor={enlarge.anchor}
          takeFocus={enlarge.takeFocus}
          onClose={closeEnlarge}
          onPointerEnter={() => window.clearTimeout(leaveTimer.current)}
          onPointerLeave={() => !enlarge.takeFocus && onCardHover(enlarge.cardId, false)}
        />
      )}
      <CountersDialog key={countersRequest ? `${countersRequest.cardId}-${countersRequest.counterId ?? ''}` : 'counters-closed'} request={countersRequest} onClose={closeCounters} />
      {placement && <PlacementBar name={placementName(session, placement)} onPlace={placeCard} onCancel={cancelPlacing} />}
    </>
  );
}

interface TablePileProps extends PileSlot {
  pile: Pile;
  render: (pile: Pile, slot: PileSlot) => ReactNode;
  /** TT-4: a press that may become a drag. */
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  /** This pile is being dragged, so it shows where it came from. */
  dragging: boolean;
}

/** A pile's spot on the table, drawn by whoever owns the pile's menus and dialogs. */
function TablePile({ pile, render, onPointerDown, dragging, ...slot }: TablePileProps) {
  return (
    <div className={dragging ? 'table-pile card-drag-source card-drag-origin' : 'table-pile card-drag-source'} style={{ left: pile.x, top: pile.y }} onPointerDown={onPointerDown}>
      {render(pile, slot)}
    </div>
  );
}
