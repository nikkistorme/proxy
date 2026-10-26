import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { loadPile } from '../actions/loadPile';
import { draw } from '../actions/pileActions';
import { importCards } from '../csv/importCards';
import type { GameState, Pile } from '../model/game';
import { useGameStore } from '../store/gameStore';
import { CardFace } from './CardFace';
import './GameScreen.css';
import { HandTray } from './HandTray';
import { ImportResults, type ImportSummary } from './ImportResults';
import { LiveRegion } from './LiveRegion';
import { PileMenu } from './PileMenu';
import { PileTile } from './PileTile';
import { seatIdentity } from './seatIdentity';

function faceOf(game: GameState, cardId: string) {
  const card = game.cards[cardId];
  return card && game.definitions[card.definitionId]?.front;
}

/** The pile the active seat draws from: its first owned pile (its main deck). */
function drawPileFor(game: GameState): Pile | undefined {
  return game.piles.find((p) => p.ownerSeatId === game.activeSeatId);
}

/** The table screen: seats, piles, cards in play and the active seat's hand. */
export function GameScreen() {
  const game = useGameStore((s) => s.game);
  const dispatch = useGameStore((s) => s.dispatch);

  const [menuPileId, setMenuPileId] = useState<string>();
  const [keepOrder, setKeepOrder] = useState<Record<string, boolean>>({});
  const [summary, setSummary] = useState<ImportSummary>();
  const loadTargetRef = useRef<string>(undefined);
  const returnFocusRef = useRef<string>(undefined);
  const fileRef = useRef<HTMLInputElement>(null);
  const tileRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Tiles register their buttons, so focus can go back to a pile after its menu or dialog closes.
  const registerTile = useCallback((pileId: string, element: HTMLButtonElement | null) => {
    tileRefs.current[pileId] = element;
  }, []);

  const activeSeat = game.seats.find((s) => s.id === game.activeSeatId);
  const drawPile = drawPileFor(game);

  const drawOne = useCallback(() => {
    if (drawPile) dispatch((g) => draw(g, { pileId: drawPile.id }));
  }, [dispatch, drawPile]);

  // D draws, unless something else has the keyboard (a field, a menu or a dialog).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'd' || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable]')) return;
      // Read what's open from the page, not React state, which can lag a dialog closing.
      if (document.querySelector('dialog[open], [role="menu"]')) return;
      event.preventDefault();
      drawOne();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [drawOne]);

  const closeMenu = useCallback(() => {
    if (menuPileId) tileRefs.current[menuPileId]?.focus();
    setMenuPileId(undefined);
  }, [menuPileId]);

  const chooseFile = useCallback((pileId: string) => {
    loadTargetRef.current = pileId;
    fileRef.current?.click();
  }, []);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    // Clear the input so choosing the same file again still loads it.
    input.value = '';
    const pileId = loadTargetRef.current;
    if (!file || !pileId) return;

    const { cards, problems } = importCards(await file.text());
    const result = dispatch((g, context) =>
      loadPile(g, { pileId, sourceName: file.name, cards, keepOrder: keepOrder[pileId] ?? false }, context),
    );
    returnFocusRef.current = pileId;
    setSummary({
      fileName: file.name,
      pileName: result.state.piles.find((p) => p.id === pileId)?.name ?? '',
      cardCount: cards.length,
      added: result.merge.added.length,
      updated: result.merge.updated.length,
      missingNames: result.merge.definitions.filter((d) => d.missing).map((d) => d.front.name),
      problems,
      shortfalls: result.shortfalls.map(({ name, extra }) => ({ name, extra })),
    });
  }

  function closeResults() {
    setSummary(undefined);
    if (returnFocusRef.current) tileRefs.current[returnFocusRef.current]?.focus();
  }

  const toggleKeepOrder = useCallback((pileId: string) => {
    setKeepOrder((k) => ({ ...k, [pileId]: !(k[pileId] ?? false) }));
  }, []);

  const drawFrom = useCallback(
    (pileId: string) => {
      dispatch((g) => draw(g, { pileId }));
    },
    [dispatch],
  );

  const seatName = (seatId: string | undefined) => game.seats.find((s) => s.id === seatId)?.name;
  const tableCards = game.table.flatMap((id) => {
    const face = faceOf(game, id);
    return face ? [{ id, face }] : [];
  });
  const handCards = (game.hands[game.activeSeatId] ?? []).flatMap((id) => {
    const face = faceOf(game, id);
    return face ? [{ id, face }] : [];
  });

  return (
    <div className="game">
      <header className="game__header">
        <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
          <rect x="3" y="5.5" width="13" height="18" rx="2.5" fill="none" stroke="var(--ink)" strokeWidth="1.6" strokeDasharray="3 2.2" />
          <rect x="9.5" y="2" width="13" height="18" rx="2.5" fill="var(--accent)" />
          <path d="M13.3 7.5h5.4M13.3 11h5.4M13.3 14.5h3.4" stroke="var(--accent-ink)" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <h1 className="game__title">Proxy</h1>
        <span className="game__format">Solo PvE</span>
      </header>

      <section className="seat-bar" aria-label="Seats">
        <ul className="seat-bar__list">
          {game.seats.map((seat) => {
            const identity = seatIdentity(seat.id);
            const active = seat.id === game.activeSeatId;
            return (
              <li key={seat.id} className="seat-bar__seat" style={active ? { boxShadow: `inset 0 -3px 0 ${identity.color}` } : undefined}>
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  <path d={identity.shape} fill={identity.color} />
                </svg>
                <span className={active ? 'seat-bar__name seat-bar__name--active' : 'seat-bar__name'}>{seat.name}</span>
                {active && (
                  <span className="seat-bar__badge" style={{ background: identity.color }}>
                    Active
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <main className="game__main">
        <section className="table-area" aria-labelledby="table-heading">
          <h2 id="table-heading" className="visually-hidden">
            Table
          </h2>
          <ul className="pile-row" aria-label="Piles">
            {game.piles.map((pile) => {
              const topId = pile.cardIds[0];
              const revealedTop = topId && game.cards[topId]?.faceUp ? faceOf(game, topId) : undefined;
              return (
                <li key={pile.id} className="pile-row__slot">
                  <PileTile
                    registerTile={registerTile}
                    pile={pile}
                    ownerName={seatName(pile.ownerSeatId)}
                    revealedTop={revealedTop}
                    menuOpen={menuPileId === pile.id}
                    onOpenMenu={() => setMenuPileId((open) => (open === pile.id ? undefined : pile.id))}
                  />
                  {menuPileId === pile.id && (
                    <PileMenu
                      pile={pile}
                      ownerName={seatName(pile.ownerSeatId)}
                      keepOrder={keepOrder[pile.id] ?? false}
                      onLoad={chooseFile}
                      onToggleKeepOrder={toggleKeepOrder}
                      onDraw={drawFrom}
                      onClose={closeMenu}
                    />
                  )}
                </li>
              );
            })}
          </ul>

          <h3 className="table-area__heading">On the table</h3>
          {tableCards.length === 0 ? (
            <p className="table-area__empty">No cards on the table yet.</p>
          ) : (
            <ul className="table-area__cards" aria-label={`Cards on the table, ${tableCards.length}`}>
              {tableCards.map((card) => (
                <li key={card.id}>
                  <CardFace face={card.face} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {activeSeat?.hasHand && (
          <HandTray seatId={activeSeat.id} seatName={activeSeat.name} cards={handCards} onDraw={drawOne} />
        )}
      </main>

      <input ref={fileRef} type="file" accept=".csv,text/csv" hidden data-testid="csv-file" onChange={(e) => void handleFile(e)} />
      <ImportResults summary={summary} onClose={closeResults} />
      <LiveRegion />
    </div>
  );
}
