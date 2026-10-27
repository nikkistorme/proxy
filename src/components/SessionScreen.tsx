import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { loadPile } from '../actions/loadPile';
import { peekTop } from '../actions/peek';
import { draw, mill, revealTop, shuffle } from '../actions/pileActions';
import { addPile, deletePile, mergePiles, renamePile, validatePileName } from '../actions/piles';
import { importCards } from '../csv/importCards';
import type { SessionState, Pile } from '../model/session';
import { readingOrder, tableItems } from '../model/tableNavigation';
import { useSessionStore } from '../store/sessionStore';
import { DeletePileDialog, type DeletePileRequest, type MergeChoice, type MergePilesRequest } from './DeletePileDialog';
import './SessionScreen.css';
import { HandTray } from './HandTray';
import { ImportResults, type ImportSummary } from './ImportResults';
import { LiveRegion } from './LiveRegion';
import { PeekDialog, type PeekRequest } from './PeekDialog';
import { PileCountDialog, type CountRequest } from './PileCountDialog';
import { PileMenu } from './PileMenu';
import { PileNameDialog, type PileNameRequest } from './PileNameDialog';
import { PILE_HINT, PILE_HINT_ID, PileTile } from './PileTile';
import { PileViewer } from './PileViewer';
import { seatIdentity } from './seatIdentity';
import { TableSurface, type PileSlot } from './TableSurface';
import { TableTools } from './TableTools';
import { Toast } from './Toast';

function faceOf(session: SessionState, cardId: string) {
  const card = session.cards[cardId];
  return card && session.definitions[card.definitionId]?.front;
}

const ADD_PILE = 'add-pile';

/** The pile the active seat draws from: its first owned pile (its main deck). */
function drawPileFor(session: SessionState): Pile | undefined {
  return session.piles.find((p) => p.ownerSeatId === session.activeSeatId);
}

/** The table screen: seats, piles, cards in play and the active seat's hand. */
export function SessionScreen() {
  const session = useSessionStore((s) => s.session);
  const dispatch = useSessionStore((s) => s.dispatch);
  const announce = useSessionStore((s) => s.announce);
  const setPlacing = useSessionStore((s) => s.setPlacing);
  const showToast = useSessionStore((s) => s.showToast);
  const drag = useSessionStore((s) => s.drag);

  /** The pile whose menu is open, and where its tile was on screen when it opened. */
  const [pileMenu, setPileMenu] = useState<{ pileId: string; rect: DOMRect }>();
  const menuPileId = pileMenu?.pileId;
  const [keepOrder, setKeepOrder] = useState<Record<string, boolean>>({});
  const [summary, setSummary] = useState<ImportSummary>();
  const [countRequest, setCountRequest] = useState<CountRequest>();
  const [nameRequest, setNameRequest] = useState<PileNameRequest>();
  const [deleteRequest, setDeleteRequest] = useState<DeletePileRequest | MergePilesRequest>();
  const [viewerPileId, setViewerPileId] = useState<string>();
  const [peekRequest, setPeekRequest] = useState<PeekRequest>();
  /** A pile id, or ADD_PILE, to focus once it has rendered (after adding or deleting a pile). */
  const pendingFocusRef = useRef<string>(undefined);
  const addPileRef = useRef<HTMLButtonElement>(null);
  const loadTargetRef = useRef<string>(undefined);
  const returnFocusRef = useRef<string>(undefined);
  const fileRef = useRef<HTMLInputElement>(null);
  const tileRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Tiles register their buttons, so focus can go back to a pile after its menu or dialog closes.
  const registerTile = useCallback((pileId: string, element: HTMLButtonElement | null) => {
    tileRefs.current[pileId] = element;
  }, []);

  const activeSeat = session.seats.find((s) => s.id === session.activeSeatId);
  const drawPile = drawPileFor(session);

  const drawOne = useCallback(() => {
    if (drawPile) dispatch((g) => draw(g, { pileId: drawPile.id }));
    else if (activeSeat) announce(`${activeSeat.name} has no pile to draw from.`);
  }, [dispatch, announce, drawPile, activeSeat]);

  // Focus a pile, a table card or Add pile once it exists in the page. Runs after every render.
  useEffect(() => {
    const pending = pendingFocusRef.current;
    if (!pending) return;
    pendingFocusRef.current = undefined;
    const card = document.querySelector<HTMLElement>(`.table-card[data-card-id="${pending}"] .table-card__button`);
    (pending === ADD_PILE ? addPileRef.current : (tileRefs.current[pending] ?? card))?.focus();
  });

  // A file dropped anywhere but a pile must not make the browser open it instead.
  useEffect(() => {
    const block = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
    };
    window.addEventListener('dragover', block);
    window.addEventListener('drop', block);
    return () => {
      window.removeEventListener('dragover', block);
      window.removeEventListener('drop', block);
    };
  }, []);

  // D draws, and V on a focused pile opens its viewer, unless something else has
  // the keyboard (a field, a menu or a dialog).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((key !== 'd' && key !== 'v') || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable]')) return;
      // Read what's open from the page, not React state, which can lag a dialog closing.
      if (document.querySelector('dialog[open], [role="menu"]')) return;
      if (key === 'v') {
        const pileId = Object.keys(tileRefs.current).find((id) => tileRefs.current[id] === target);
        if (!pileId) return;
        event.preventDefault();
        setViewerPileId(pileId);
        return;
      }
      event.preventDefault();
      drawOne();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [drawOne]);

  const closeMenu = useCallback(() => {
    if (menuPileId) tileRefs.current[menuPileId]?.focus();
    setPileMenu(undefined);
  }, [menuPileId]);

  // The menu opens outside the zoomed table, so it's the same size at any zoom and never clipped.
  function togglePileMenu(pileId: string) {
    const rect = tileRefs.current[pileId]?.getBoundingClientRect();
    setPileMenu((open) => (open?.pileId === pileId || !rect ? undefined : { pileId, rect }));
  }

  function openPileMenu(pileId: string) {
    const rect = tileRefs.current[pileId]?.getBoundingClientRect();
    if (rect) setPileMenu({ pileId, rect });
  }

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
    if (file && pileId) await loadFile(pileId, file);
  }

  /** SP-1: load a CSV into a pile, from the file picker or a drop. */
  async function loadFile(pileId: string, file: File) {
    returnFocusRef.current = pileId;
    const pileName = session.piles.find((p) => p.id === pileId)?.name ?? '';
    const looksLikeCsv = file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv';
    if (!looksLikeCsv) {
      const problem = { row: 1, message: `${file.name} isn't a CSV file. Nothing was loaded.` };
      setSummary({ fileName: file.name, pileName, cardCount: 0, added: 0, updated: 0, missingNames: [], problems: [problem] });
      return;
    }

    const { cards, problems } = importCards(await file.text());
    const result = dispatch((g, context) =>
      loadPile(g, { pileId, sourceName: file.name, cards, keepOrder: keepOrder[pileId] ?? false }, context),
    );
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

  /**
   * Gives focus back to a pile after its dialog closes. The dialog's close event
   * can arrive a moment late, so only do it if focus was lost with the dialog,
   * never by taking it from wherever the player has already moved on to.
   */
  function returnFocusToPile(pileId: string | undefined) {
    const active = document.activeElement;
    // Lost means on the page body or inside a dialog that has closed, not in one that has just opened.
    const focusWasLost = !active || active === document.body || active.closest('dialog:not([open])') !== null;
    if (pileId && focusWasLost) tileRefs.current[pileId]?.focus();
  }

  function closeResults() {
    setSummary(undefined);
    returnFocusToPile(returnFocusRef.current);
  }

  const openDrawMany = useCallback(
    (pileId: string) => {
      const pile = session.piles.find((p) => p.id === pileId);
      const seat = session.seats.find((s) => s.id === session.activeSeatId);
      if (pile && seat) setCountRequest({ mode: 'draw', pile, handName: seat.name });
    },
    [session],
  );

  const openMill = useCallback(
    (pileId: string) => {
      const pile = session.piles.find((p) => p.id === pileId);
      if (pile) setCountRequest({ mode: 'mill', pile, targets: session.piles.filter((p) => p.id !== pileId) });
    },
    [session],
  );

  const openPeek = useCallback(
    (pileId: string) => {
      const pile = session.piles.find((p) => p.id === pileId);
      if (pile) setCountRequest({ mode: 'peek', pile });
    },
    [session],
  );

  function confirmCount(count: number, toPileId?: string) {
    if (!countRequest) return;
    const pileId = countRequest.pile.id;
    if (countRequest.mode === 'peek') {
      // Looking changes nothing, so it's a read and an announcement, not an action (SP-9).
      const peek = peekTop(session, { pileId, count });
      announce(peek.announcement);
      setPeekRequest({ pileId, cardIds: peek.cardIds });
    } else if (countRequest.mode === 'draw') dispatch((g) => draw(g, { pileId, count }));
    else if (toPileId) dispatch((g) => mill(g, { pileId, count, toPileId }));
  }

  function closeCount() {
    setCountRequest(undefined);
    returnFocusToPile(countRequest?.pile.id);
  }

  const openRename = useCallback(
    (pileId: string) => {
      const pile = session.piles.find((p) => p.id === pileId);
      if (pile) setNameRequest({ mode: 'rename', pile });
    },
    [session],
  );

  /**
   * Deletes a pile and offers Undo. Focus moves to the next pile or card on the
   * table in reading order, else the one before, or Add pile if the table is empty.
   */
  const removePile = useCallback(
    (pileId: string, moveCardsToPileId?: string) => {
      const order = readingOrder(tableItems(session));
      const index = order.indexOf(pileId);
      const next = order[index + 1] ?? order[index - 1];
      const name = session.piles.find((p) => p.id === pileId)?.name ?? '';
      dispatch((g) => deletePile(g, moveCardsToPileId === undefined ? { pileId } : { pileId, moveCardsToPileId }));
      showToast(`Deleted ${name}.`);
      pendingFocusRef.current = next ?? ADD_PILE;
    },
    [session, dispatch, showToast],
  );

  // An empty pile goes at once, with Undo in the toast. A pile with cards asks where they go.
  const openDelete = useCallback(
    (pileId: string) => {
      const pile = session.piles.find((p) => p.id === pileId);
      if (!pile) return;
      if (pile.cardIds.length === 0) removePile(pileId);
      else setDeleteRequest({ pile, targets: session.piles.filter((p) => p.id !== pileId) });
    },
    [session, removePile],
  );

  const validateName = useCallback((name: string, exceptPileId?: string) => validatePileName(session, name, exceptPileId), [session]);

  function confirmName(name: string, ownerSeatId: string | undefined) {
    if (nameRequest?.mode === 'rename') {
      const pileId = nameRequest.pile.id;
      dispatch((g) => renamePile(g, { pileId, name }));
      return;
    }
    const result = dispatch((g, context) =>
      addPile(g, ownerSeatId === undefined ? { name } : { name, ownerSeatId }, context),
    );
    pendingFocusRef.current = result.pileId;
  }

  function closeName() {
    const pileId = nameRequest?.mode === 'rename' ? nameRequest.pile.id : undefined;
    setNameRequest(undefined);
    if (pileId) returnFocusToPile(pileId);
    else returnFocusToAddPile();
  }

  function confirmDelete(moveCardsToPileId: string | undefined) {
    if (deleteRequest) removePile(deleteRequest.pile.id, moveCardsToPileId);
  }

  // TT-4: a pile dropped or placed on another pile. Nothing moves until the merge is confirmed.
  const requestMerge = useCallback(
    (pileId: string, otherPileId: string) => {
      const pile = session.piles.find((p) => p.id === pileId);
      const other = session.piles.find((p) => p.id === otherPileId);
      if (pile && other) setDeleteRequest({ mode: 'merge', pile, other });
    },
    [session],
  );

  function confirmMerge({ fromPileId, intoPileId, end }: MergeChoice) {
    const from = session.piles.find((p) => p.id === fromPileId)?.name ?? '';
    const into = session.piles.find((p) => p.id === intoPileId)?.name ?? '';
    dispatch((g) => mergePiles(g, { fromPileId, intoPileId, end }));
    showToast(`Merged ${from} into ${into}.`);
    pendingFocusRef.current = intoPileId;
  }

  function closeDelete() {
    const pileId = deleteRequest?.pile.id;
    setDeleteRequest(undefined);
    // If the pile still exists, the delete was cancelled, or it took the other pile's cards in a merge.
    if (pileId && session.piles.some((p) => p.id === pileId)) returnFocusToPile(pileId);
  }

  function closePeek() {
    setPeekRequest(undefined);
    returnFocusToPile(peekRequest?.pileId);
  }

  function closeViewer() {
    setViewerPileId(undefined);
    returnFocusToPile(viewerPileId);
  }

  function returnFocusToAddPile() {
    const active = document.activeElement;
    if (!active || active === document.body || active.closest('dialog')) addPileRef.current?.focus();
  }

  const shuffleFrom = useCallback(
    (pileId: string) => {
      dispatch((g, context) => shuffle(g, { pileId }, context));
    },
    [dispatch],
  );

  const revealFrom = useCallback(
    (pileId: string) => {
      dispatch((g) => revealTop(g, { pileId }));
    },
    [dispatch],
  );

  const toggleKeepOrder = useCallback((pileId: string) => {
    setKeepOrder((k) => ({ ...k, [pileId]: !(k[pileId] ?? false) }));
  }, []);

  const drawFrom = useCallback(
    (pileId: string) => {
      dispatch((g) => draw(g, { pileId }));
    },
    [dispatch],
  );

  const seatName = (seatId: string | undefined) => session.seats.find((s) => s.id === seatId)?.name;

  // 3m: piles sit on the table with the cards, and share its one Tab stop.
  function renderPile(pile: Pile, slot: PileSlot) {
    const topId = pile.cardIds[0];
    const revealedTop = topId && session.cards[topId]?.side === 'front' ? faceOf(session, topId) : undefined;
    return (
      <PileTile
        registerTile={(pileId, element) => {
          registerTile(pileId, element);
          slot.register(element);
        }}
        tabbable={slot.tabbable}
        onFocus={slot.onFocus}
        onKeyDown={slot.onKeyDown}
        onKeyUp={slot.onKeyUp}
        onDraw={() => drawFrom(pile.id)}
        onDropFile={(id, file) => void loadFile(id, file)}
        cardOver={drag?.cardId !== undefined && drag.over?.zone === 'pile' && drag.over.pileId === pile.id}
        mergeTarget={slot.mergeTarget}
        pile={pile}
        ownerName={seatName(pile.ownerSeatId)}
        revealedTop={revealedTop}
        menuOpen={menuPileId === pile.id}
        onOpenMenu={() => togglePileMenu(pile.id)}
      />
    );
  }

  const menuPile = session.piles.find((p) => p.id === menuPileId);

  return (
    <div className="session">
      <header className="session__header">
        <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
          <rect x="3" y="5.5" width="13" height="18" rx="2.5" fill="none" stroke="var(--ink)" strokeWidth="1.6" strokeDasharray="3 2.2" />
          <rect x="9.5" y="2" width="13" height="18" rx="2.5" fill="var(--accent)" />
          <path d="M13.3 7.5h5.4M13.3 11h5.4M13.3 14.5h3.4" stroke="var(--accent-ink)" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <h1 className="session__title">Proxy</h1>
        <span className="session__format">Solo PvE</span>
        <TableTools addPileRef={addPileRef} onAddPile={() => setNameRequest({ mode: 'add', defaultOwnerId: session.activeSeatId })} />
      </header>

      <section className="seat-bar" aria-label="Seats">
        <ul className="seat-bar__list">
          {session.seats.map((seat) => {
            const identity = seatIdentity(seat.id);
            const active = seat.id === session.activeSeatId;
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

      <main className="session__main">
        <section className="table-area" aria-labelledby="table-heading">
          <h2 id="table-heading" className="visually-hidden">
            Table
          </h2>
          <TableSurface renderPile={renderPile} openPileMenu={openPileMenu} requestMerge={requestMerge} />
          <span id={PILE_HINT_ID} hidden>
            {PILE_HINT}
          </span>
        </section>

        {activeSeat?.hasHand && (
          <HandTray seatId={activeSeat.id} seatName={activeSeat.name} onDraw={drawOne} />
        )}
      </main>

      {pileMenu && menuPile && (
        <div className="pile-menu-anchor" style={{ left: pileMenu.rect.left, top: pileMenu.rect.top, width: pileMenu.rect.width, height: pileMenu.rect.height }}>
          <PileMenu
            pile={menuPile}
            ownerName={seatName(menuPile.ownerSeatId)}
            keepOrder={keepOrder[menuPile.id] ?? false}
            onView={setViewerPileId}
            onMoveOnTable={(pileId) => setPlacing({ pileId })}
            onLoad={chooseFile}
            onToggleKeepOrder={toggleKeepOrder}
            onDraw={drawFrom}
            onDrawMany={openDrawMany}
            onShuffle={shuffleFrom}
            onReveal={revealFrom}
            onPeek={openPeek}
            onMill={openMill}
            canMill={session.piles.length > 1}
            onRename={openRename}
            onDelete={openDelete}
            canDelete={menuPile.cardIds.length === 0 || session.piles.length > 1}
            onClose={closeMenu}
          />
        </div>
      )}
      <input ref={fileRef} type="file" accept=".csv,text/csv" hidden data-testid="csv-file" onChange={(e) => void handleFile(e)} />
      <ImportResults summary={summary} onClose={closeResults} />
      <PileNameDialog
        key={nameRequest ? (nameRequest.mode === 'rename' ? `rename-${nameRequest.pile.id}` : 'add') : 'closed'}
        request={nameRequest}
        seats={session.seats}
        validateName={validateName}
        onConfirm={confirmName}
        onClose={closeName}
      />
      <DeletePileDialog
        key={deleteRequest ? `${deleteRequest.mode ?? 'delete'}-${deleteRequest.pile.id}` : 'closed'}
        request={deleteRequest}
        onConfirm={confirmDelete}
        onMerge={confirmMerge}
        onClose={closeDelete}
      />
      <PileCountDialog
        key={countRequest ? `${countRequest.mode}-${countRequest.pile.id}` : 'closed'}
        request={countRequest}
        onConfirm={confirmCount}
        onClose={closeCount}
      />
      <PeekDialog key={peekRequest ? `peek-${peekRequest.pileId}` : 'closed'} request={peekRequest} onClose={closePeek} />
      <PileViewer key={viewerPileId ?? 'closed'} pileId={viewerPileId} onClose={closeViewer} />
      <Toast />
      <LiveRegion />
    </div>
  );
}
