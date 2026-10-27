import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { moveCard, type Destination } from '../actions/moveCard';
import { useGameStore } from '../store/gameStore';
import { CardDetailsDialog } from './CardDetailsDialog';
import { CardFace } from './CardFace';
import { HandCardMenu, type HandCommand } from './HandCardMenu';
import './HandTray.css';
import { moveDestinations } from './moveDestinations';
import { MoveDialog, type MoveRequest } from './MoveDialog';
import { seatIdentity } from './seatIdentity';

interface HandTrayProps {
  seatId: string;
  seatName: string;
  onDraw: () => void;
}

const HAND_KEYS: Record<string, HandCommand> = { p: 'play', m: 'move' };

/**
 * The active seat's hand (FS-3), with Draw (SP-6). Follows the Main board's hand
 * tray. The cards are one Tab stop with ← and → between them, and each opens a
 * menu to play it or move it (TT-4, SP-8).
 */
export function HandTray({ seatId, seatName, onDraw }: HandTrayProps) {
  const headingId = useId();
  const identity = seatIdentity(seatId);
  const game = useGameStore((s) => s.game);
  const dispatch = useGameStore((s) => s.dispatch);

  const [activeId, setActiveId] = useState<string>();
  const [menu, setMenu] = useState<{ cardId: string; rect: DOMRect }>();
  const [moveRequest, setMoveRequest] = useState<MoveRequest>();
  const [detailsCardId, setDetailsCardId] = useState<string>();
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({});
  const drawRef = useRef<HTMLButtonElement>(null);
  /** The card to focus once a change has rendered, or 'draw' when the hand is empty. */
  const pendingFocus = useRef<string>(undefined);
  /** Where focus goes once a dialog that moved a card has closed. */
  const afterDialog = useRef<string>(undefined);

  const hand = game.hands[seatId] ?? [];
  const cards = hand.flatMap((id) => {
    const definition = game.definitions[game.cards[id]?.definitionId ?? ''];
    return definition ? [{ id, face: definition.front, name: definition.back ? `${definition.front.name}, double-faced` : definition.front.name }] : [];
  });
  const count = `${cards.length} ${cards.length === 1 ? 'card' : 'cards'}`;
  const tabbableId = activeId && hand.includes(activeId) ? activeId : hand[0];

  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = undefined;
    (target === 'draw' ? drawRef.current : buttons.current[target])?.focus();
  });

  /** The card that takes a leaving card's place, else the one before it, else Draw. */
  const afterLeaving = (cardId: string) => {
    const index = hand.indexOf(cardId);
    return hand[index + 1] ?? hand[index - 1] ?? 'draw';
  };

  function move(cardId: string, to: Destination) {
    pendingFocus.current = afterLeaving(cardId);
    dispatch((g, context) => moveCard(g, { cardId, to }, context));
  }

  function runCommand(cardId: string, command: HandCommand) {
    if (command === 'play') move(cardId, { zone: 'table' });
    else if (command === 'move') {
      const face = cards.find((c) => c.id === cardId)?.face;
      if (face) setMoveRequest({ cardId, face, fromName: `${seatName}'s hand`, options: moveDestinations(game, cardId) });
    } else setDetailsCardId(cardId);
  }

  function openMenu(cardId: string) {
    const rect = buttons.current[cardId]?.getBoundingClientRect();
    if (rect) setMenu((open) => (open?.cardId === cardId ? undefined : { cardId, rect }));
  }

  function closeMenu() {
    // Back to the card, unless an action already sent focus elsewhere or a dialog took it.
    if (menu && !pendingFocus.current && !document.querySelector('dialog[open]')) pendingFocus.current = menu.cardId;
    setMenu(undefined);
  }

  function confirmMove(to: Destination) {
    if (!moveRequest) return;
    afterDialog.current = afterLeaving(moveRequest.cardId);
    dispatch((g, context) => moveCard(g, { cardId: moveRequest.cardId, to }, context));
  }

  /** After a dialog closes: back to the card if it's still in the hand, else where a move sent focus. */
  function focusAfterDialog(cardId: string | undefined) {
    // The dialog closes before a move re-renders, and puts focus back itself, so wait for both.
    window.setTimeout(() => {
      const target = afterDialog.current ?? cardId;
      afterDialog.current = undefined;
      const element = target === 'draw' ? drawRef.current : target ? buttons.current[target] : undefined;
      (element?.isConnected ? element : drawRef.current)?.focus();
    });
  }

  function onCardKeyDown(cardId: string, event: KeyboardEvent<HTMLButtonElement>) {
    const { key } = event;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (key === 'Enter' || key === 'ContextMenu' || (key === 'F10' && event.shiftKey)) {
      event.preventDefault();
      openMenu(cardId);
      return;
    }
    const command = event.shiftKey ? undefined : HAND_KEYS[key.toLowerCase()];
    if (command) {
      event.preventDefault();
      runCommand(cardId, command);
      return;
    }
    const index = hand.indexOf(cardId);
    const next = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: hand.length - 1 }[key];
    if (next === undefined || event.shiftKey) return;
    event.preventDefault();
    const target = hand[Math.max(0, Math.min(hand.length - 1, next))];
    if (target) buttons.current[target]?.focus();
  }

  return (
    <section className="hand-tray" aria-labelledby={headingId} style={{ borderTopColor: identity.color }}>
      <div className="hand-tray__header">
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <path d={identity.shape} fill={identity.color} />
        </svg>
        <h2 id={headingId} className="hand-tray__title">
          {seatName}'s hand
        </h2>
        <span className="hand-tray__count">{count}</span>
        <button ref={drawRef} type="button" className="hand-tray__draw" aria-keyshortcuts="D" onClick={onDraw}>
          Draw{' '}
          <kbd className="hand-tray__kbd" aria-hidden="true">
            D
          </kbd>
        </button>
      </div>
      {cards.length === 0 ? (
        <p className="hand-tray__empty">No cards in hand. Draw from {seatName}'s deck to start.</p>
      ) : (
        <ul className="hand-tray__cards" aria-label={`${seatName}'s hand, ${count}. Arrow keys move between cards.`}>
          {cards.map((card) => (
            <li key={card.id} className="hand-tray__card">
              <div aria-hidden="true">
                <CardFace face={card.face} width={104} />
              </div>
              <button
                ref={(element) => {
                  buttons.current[card.id] = element;
                }}
                type="button"
                className="hand-tray__card-button"
                aria-label={card.name}
                aria-haspopup="menu"
                aria-expanded={menu?.cardId === card.id}
                tabIndex={card.id === tabbableId ? 0 : -1}
                onFocus={() => setActiveId(card.id)}
                onClick={(event) => {
                  event.currentTarget.focus();
                  openMenu(card.id);
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.currentTarget.focus();
                  if (menu?.cardId !== card.id) openMenu(card.id);
                }}
                onKeyDown={(event) => onCardKeyDown(card.id, event)}
              />
            </li>
          ))}
        </ul>
      )}
      {/* Outside the scrolling row, which would clip it. */}
      {menu && hand.includes(menu.cardId) && (
        <div className="hand-card-menu-anchor" style={{ left: menu.rect.left, top: menu.rect.top, width: menu.rect.width, height: menu.rect.height }}>
          <HandCardMenu
            name={cards.find((c) => c.id === menu.cardId)?.name ?? ''}
            seatName={seatName}
            onCommand={(command) => runCommand(menu.cardId, command)}
            onClose={closeMenu}
          />
        </div>
      )}
      <MoveDialog
        key={moveRequest?.cardId ?? 'closed'}
        request={moveRequest}
        onConfirm={confirmMove}
        onClose={() => {
          focusAfterDialog(moveRequest?.cardId);
          setMoveRequest(undefined);
        }}
      />
      <CardDetailsDialog
        game={game}
        cardId={detailsCardId}
        faceUp
        onClose={() => {
          focusAfterDialog(detailsCardId);
          setDetailsCardId(undefined);
        }}
      />
    </section>
  );
}
