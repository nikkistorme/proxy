import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import { cardBox, CARD_H, CARD_W, clampToTable, columnsFor, describeSpot, freeSpot, overlaps, pileBox, TABLE_GAP } from '../model/tablePlacement';
import { nearestInDirection, readingOrder, tableItems, type Direction } from '../model/tableNavigation';
import { clampZoom, fitAll, GRID_X, GRID_Y, MAX_ZOOM, scrollAfterZoom, snapToGrid, stepZoom, zoomPercent, type Scroll } from '../model/tableView';
import { bringToFront, deleteCard, duplicate, flip, rotate, sendToBack, shownName } from '../actions/cardActions';
import { cardName } from '../actions/helpers';
import { moveCard, type Destination } from '../actions/moveCard';
import type { GameState, Pile, Rotation } from '../model/game';
import { useGameStore } from '../store/gameStore';
import { useCardDrag } from './cardDrag';
import { CardDetailsDialog } from './CardDetailsDialog';
import { CardMenu, type CardCommand } from './CardMenu';
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

/** The card being placed and where its outline is (A11Y-1). */
interface Placement {
  cardId: string;
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
}

const plural = (count: number, word: string) => `${count} ${count === 1 ? word : `${word}s`}`;

/** The name a card being placed goes by: as it shows on the table, or as its owner sees it in the hand. */
function placingName(game: GameState, cardId: string): string {
  if (game.table.some((e) => e.cardId === cardId)) return shownName(game, cardId);
  const name = shownName(game, cardId);
  return name === 'a face-down card' ? cardName(game, cardId) : name;
}

/** Whether a card can still be placed: it's on the table or in a hand. */
function placeable(game: GameState, cardId: string): boolean {
  return game.table.some((e) => e.cardId === cardId) || Object.values(game.hands).some((hand) => hand.includes(cardId));
}

interface TableSurfaceProps {
  /** Draws a pile on the table. The game screen owns piles' menus and dialogs, so it draws them. */
  renderPile?: (pile: Pile, slot: PileSlot) => ReactNode;
}

/**
 * The free-form table. Cards and piles sit at their positions on a mat that pans
 * and zooms (TT-1) inside its own viewport. The table is one Tab stop, and arrow
 * keys move focus to the nearest card or pile in that direction (A11Y-3).
 */
export function TableSurface({ renderPile }: TableSurfaceProps = {}) {
  const game = useGameStore((s) => s.game);
  const { zoom, snap } = useGameStore((s) => s.view);
  const setView = useGameStore((s) => s.setView);
  const announce = useGameStore((s) => s.announce);
  const setTableViewport = useGameStore((s) => s.setTableViewport);

  const dispatch = useGameStore((s) => s.dispatch);
  const showToast = useGameStore((s) => s.showToast);
  const dismissToast = useGameStore((s) => s.dismissToast);
  const placing = useGameStore((s) => s.placing);
  const setPlacing = useGameStore((s) => s.setPlacing);
  const columnsInView = useGameStore((s) => s.view.columns);
  const drag = useGameStore((s) => s.drag);
  const startDrag = useCardDrag();

  const [activeId, setActiveId] = useState<string>();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [menu, setMenu] = useState<{ cardId: string; rect: DOMRect }>();
  const [moveRequest, setMoveRequest] = useState<MoveRequest>();
  const [detailsCardId, setDetailsCardId] = useState<string>();
  const [placement, setPlacement] = useState<Placement>();
  const placementRef = useRef<HTMLButtonElement>(null);
  /** Where the last pointer went down, so a pan isn't taken for a click. */
  const pointerDownAt = useRef<{ x: number; y: number }>(undefined);
  /** The latest game and outline, for effects that only run when placing starts. */
  const latest = useRef({ game, placement });
  useLayoutEffect(() => {
    latest.current = { game, placement };
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
  const piles = renderPile ? game.piles : [];
  const tableRef = useRef(game.table);
  const pilesRef = useRef(piles);
  useLayoutEffect(() => {
    zoomRef.current = zoom;
    tableRef.current = game.table;
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
  const items = tableItems({ table: game.table, piles });

  /** The card or pile that takes a leaving card's place: the next in reading order, else the one before. */
  const neighbourOf = (cardId: string) => {
    const order = readingOrder(items);
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
      case 'place':
        setPlacing({ cardId });
        pendingFocus.current = 'none';
        return;
    }
    // Re-ordering moves the card's element, which can drop focus, so put it back.
    pendingFocus.current = { card: cardId };
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
    // Placing puts focus on the outline instead.
    if (!choseSpot.current) focusAfterDialog(moveRequest?.cardId);
    choseSpot.current = false;
    setMoveRequest(undefined);
  }

  function closeDetails() {
    focusAfterDialog(detailsCardId);
    setDetailsCardId(undefined);
  }

  // A11Y-1: placing starts when the store names a card, from here, the hand or the Move to… dialog.
  // The outline starts where the card is, or at the next free spot for a card coming from the hand.
  const placingId = placing && placeable(game, placing.cardId) ? placing.cardId : undefined;
  if (placingId !== placement?.cardId) {
    const entry = game.table.find((e) => e.cardId === placingId);
    const start = entry ?? { ...freeSpot(game, columnsInView), rotation: 0 as Rotation };
    setPlacement(placingId ? { cardId: placingId, x: start.x, y: start.y, rotation: start.rotation } : undefined);
    if (placingId) setMenu(undefined);
  }

  // An undo can take away the card being placed.
  useEffect(() => {
    if (placing && !placeable(game, placing.cardId)) setPlacing(undefined);
  }, [placing, game, setPlacing]);

  const startedId = placement?.cardId;
  useEffect(() => {
    if (!startedId) return;
    const { game: current } = latest.current;
    const spot = latest.current.placement;
    dismissToast();
    if (spot) announce(`Picked up ${placingName(current, startedId)}. ${describeSpot(spot)}. Arrow keys move it, Enter places it, Escape cancels.`);
    // After any dialog that started it has closed and put focus back.
    window.setTimeout(() => placementRef.current?.focus());
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
    // The topmost card under the outline, then any pile.
    const under = [
      ...[...game.table].reverse().filter((e) => e.cardId !== placement.cardId && overlaps(cardBox(e), box)).map((e) => shownName(game, e.cardId)),
      ...piles.filter((p) => overlaps(pileBox(p), box)).map((p) => p.name),
    ];
    const over = under[0] ? `, over ${under[0]}${under.length > 1 ? ` and ${under.length - 1} more` : ''}` : '';
    announce(`${describeSpot(spot)}${over}.`);
  }

  function placeCard() {
    if (!placement) return;
    const { cardId, x, y } = placement;
    dispatch((g, context) => moveCard(g, { cardId, to: { zone: 'table', position: { x, y } } }, context));
    pendingFocus.current = { card: cardId };
    setPlacing(undefined);
  }

  function cancelPlacing() {
    if (!placement || !placing) return;
    announce(`Put ${placingName(game, placement.cardId)} back.`);
    if (game.table.some((e) => e.cardId === placement.cardId)) pendingFocus.current = { card: placement.cardId };
    else placing.returnFocus?.();
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
    const entry = game.table.find((e) => e.cardId === cardId);
    const visual = event.currentTarget.closest<HTMLElement>('.table-card');
    if (!entry || !visual) return;
    const name = shownName(game, cardId);
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
    });
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

  // On a pile, plain arrows move between cards and piles; its other keys are the pile's own.
  function onPileKeyDown(pileId: string, event: KeyboardEvent<HTMLButtonElement>) {
    const direction = ARROWS[event.key];
    if (!direction || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    const next = nearestInDirection(items, pileId, direction);
    if (next) buttons.current[next]?.focus();
  }

  function onCardKeyUp(cardId: string, event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== ' ' || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    runCommand(cardId, 'place');
  }

  const count = game.table.length;
  const label = `Table, ${plural(count, 'card')}${renderPile ? `, ${plural(piles.length, 'pile')}` : ''}`;
  // The Tab stop is the last card focused, or the first in reading order once that card has gone.
  const tabbableId = activeId && items.some((item) => item.id === activeId) ? activeId : readingOrder(items)[0];
  // The mat reaches past the last card, so there's room to pan and drop, and always fills the view.
  const outline = placement && cardBox(placement);
  // Where a dragged card would land, turned as it is now.
  const dropAt = drag?.over?.zone === 'table' ? drag.over.position : undefined;
  const dropBox = dropAt && cardBox({ ...dropAt, rotation: game.table.find((e) => e.cardId === drag?.cardId)?.rotation ?? 0 });
  const boxes = [...game.table.map(cardBox), ...piles.map(pileBox), ...(outline ? [outline] : []), ...(dropBox ? [dropBox] : [])];
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
                />
              ))}
            {game.table.map((entry, index) => (
              <TableCard
                key={entry.cardId}
                view={tableCardView(game, entry)}
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
                aria-label={`Placing ${placingName(game, placement.cardId)}, ${describeSpot(placement)}. Arrow keys move, Enter places, Escape cancels.`}
                onKeyDown={onPlacementKeyDown}
                onKeyUp={(event) => {
                  if (event.key !== ' ' || event.altKey || event.ctrlKey || event.metaKey) return;
                  event.preventDefault();
                  placeCard();
                }}
              >
                <span aria-hidden="true">{placingName(game, placement.cardId)}</span>
              </button>
            )}
          </div>
        </div>
      </div>
      {/* The menu sits outside the zoomed mat, so it's the same size at any zoom. */}
      {menu && game.table.some((e) => e.cardId === menu.cardId) && (
        <div className="card-menu-anchor" style={{ left: menu.rect.left, top: menu.rect.top, width: menu.rect.width, height: menu.rect.height }}>
          <CardMenu game={game} cardId={menu.cardId} onCommand={(command) => runCommand(menu.cardId, command)} onClose={closeMenu} />
        </div>
      )}
      <MoveDialog key={moveRequest?.cardId ?? 'closed'} request={moveRequest} onConfirm={confirmMove} onChooseSpot={chooseSpot} onClose={closeMove} />
      <CardDetailsDialog game={game} cardId={detailsCardId} onClose={closeDetails} />
      {placement && <PlacementBar name={placingName(game, placement.cardId)} onPlace={placeCard} onCancel={cancelPlacing} />}
    </>
  );
}

/** A pile's spot on the table, drawn by whoever owns the pile's menus and dialogs. */
function TablePile({ pile, render, ...slot }: PileSlot & { pile: Pile; render: (pile: Pile, slot: PileSlot) => ReactNode }) {
  return (
    <div className="table-pile" style={{ left: pile.x, top: pile.y }}>
      {render(pile, slot)}
    </div>
  );
}
