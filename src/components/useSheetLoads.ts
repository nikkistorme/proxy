import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LoadPileArgs } from '../actions/loadPile';
import { loadPiles, sheetsAnnouncement } from '../actions/loadPiles';
import { fetchCards, type FetchCardsResult } from '../csv/fetchCards';
import { classifySheetUrl } from '../csv/sheetUrl';
import { useFormats } from '../formats/FormatsProvider';
import { cardSetItem } from '../model/cardSet';
import { formatById } from '../model/format';
import { reloadAllTargets, type SheetTarget } from '../model/sheetTargets';
import { useStorage } from '../storage/StorageProvider';
import { newItemId } from '../storage/storage';
import { useSessionStore, useSessionStoreApi } from '../store/sessionStore';
import type { ImportSummary } from './ImportResults';
import { needsAttention, type SheetResultItem, type SheetResultsData } from './SheetResults';

type Outcome = { target: SheetTarget; sourceName: string } & ({ ok: true; fetched: Extract<FetchCardsResult, { ok: true }>; url: string } | { ok: false; error: string });

/** Fetches one target. A stored address that no longer passes the check is a failure for that pile, not a crash. */
async function fetchTarget(target: SheetTarget, sourceName: string | undefined): Promise<Outcome> {
  const checked = classifySheetUrl(target.url);
  if (checked.kind !== 'ok') return { target, sourceName: sourceName ?? target.url, ok: false, error: checked.error };
  const fetched = await fetchCards(checked.url, checked.fallbackName);
  const name = sourceName ?? checked.fallbackName;
  return fetched.ok ? { target, sourceName: name, ok: true, fetched, url: checked.url } : { target, sourceName: name, ok: false, error: fetched.error };
}

/**
 * CD-12: sheet fetching for the table. A session start and Reload all fetch every
 * target at once and apply what arrived as one action (one undo step). This also
 * holds which piles are fetching (a single Reload from URL too), the errors of
 * piles that couldn't load, and the results dialog's data. All of it is transient.
 */
export function useSheetLoads(keepOrder: Readonly<Record<string, boolean>>) {
  const store = useSessionStoreApi();
  const storage = useStorage();
  const { formats } = useFormats();
  const session = useSessionStore((s) => s.session);
  const sessionId = useSessionStore((s) => s.sessionId);
  // Keyed by session, so a late answer or a stale error from an earlier session is never read.
  const [flying, setFlying] = useState<ReadonlySet<string>>(new Set());
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  /** The session a Reload all is running in, so a new session starts with nothing running. */
  const [reloadingIn, setReloadingIn] = useState<string>();
  const [results, setResults] = useState<SheetResultsData>();
  const latest = useRef({ keepOrder, storage });
  useEffect(() => {
    latest.current = { keepOrder, storage };
  });

  const key = useCallback((pileId: string, id = sessionId) => `${id}:${pileId}`, [sessionId]);
  const flyingNow = useMemo(() => [...flying].filter((k) => k.startsWith(`${sessionId}:`)), [flying, sessionId]);

  const setFlight = useCallback((id: string, pileIds: readonly string[], on: boolean) => {
    setFlying((set) => {
      const next = new Set(set);
      for (const pileId of pileIds) {
        if (on) next.add(`${id}:${pileId}`);
        else next.delete(`${id}:${pileId}`);
      }
      return next;
    });
  }, []);

  /** Marks a single pile's fetch (Reload from URL, Load from URL…) so the same pile can't be fetched twice at once. */
  const markFetching = useCallback((pileId: string, on: boolean, id?: string) => setFlight(id ?? store.getState().sessionId, [pileId], on), [setFlight, store]);

  const setPileError = useCallback(
    (pileId: string, error: string | undefined, onlyIfSet = false) => {
      const k = key(pileId);
      setErrors((current) => {
        if (error === undefined && !(k in current)) return current;
        if (onlyIfSet && !(k in current)) return current;
        const rest = Object.fromEntries(Object.entries(current).filter(([name]) => name !== k));
        return error === undefined ? rest : { ...rest, [k]: error };
      });
    },
    [key],
  );

  const runBatch = useCallback(
    async (kind: 'start' | 'reload', targets: readonly SheetTarget[]) => {
      const startId = store.getState().sessionId;
      const ids = targets.map((t) => t.pileId);
      setFlight(startId, ids, true);
      setErrors((current) => Object.fromEntries(Object.entries(current).filter(([k]) => !ids.some((id) => k === `${startId}:${id}`))));
      const before = store.getState().session;
      const outcomes = await Promise.all(
        targets.map((target) => {
          const pile = before.piles.find((p) => p.id === target.pileId);
          return fetchTarget(target, pile?.cardSetId ? before.cardSets[pile.cardSetId]?.source.name : undefined);
        }),
      );
      setFlight(startId, ids, false);
      const live = store.getState();
      // A new session replaced this one: its piles may share ids with these, so drop everything.
      if (live.sessionId !== startId) return;
      // A pile deleted meanwhile is skipped. At a start, so is one the player loaded themselves.
      const current = outcomes.filter((o) => {
        const pile = live.session.piles.find((p) => p.id === o.target.pileId);
        return pile !== undefined && !(kind === 'start' && pile.cardSetId !== undefined);
      });
      if (current.length === 0) return;

      const fetchedAt = Date.now();
      const successes = current.filter((o): o is Extract<Outcome, { ok: true }> => o.ok);
      const failures = current.filter((o) => !o.ok);
      const verb = kind === 'start' ? 'Loaded' : 'Reloaded';
      const failedNames = failures.map((o) => o.target.pileName);

      const summaries = new Map<string, ImportSummary>();
      if (successes.length === 0) {
        live.announce(sheetsAnnouncement(verb, 0, failedNames));
      } else {
        const result = live.dispatch((g, context) => {
          const loads: LoadPileArgs[] = successes.map((o) => ({
            pileId: o.target.pileId,
            // A reload updates the pile's card set; a first load makes a new one (AR-4).
            cardSetId: g.piles.find((p) => p.id === o.target.pileId)?.cardSetId ?? newItemId(),
            source: { kind: 'url', name: o.fetched.fileName, url: o.url, fetchedAt },
            cards: o.fetched.cards,
            keepOrder: latest.current.keepOrder[o.target.pileId] ?? false,
          }));
          return { ...loadPiles(g, { loads, failed: failedNames, verb }, context), loads };
        });
        result.results.forEach((r, index) => {
          const load = result.loads[index];
          const outcome = successes[index];
          if (!load || !outcome) return;
          // The session has its own copy of the cards, so play goes on if the save fails (AR-4, PS-6).
          const cardSet = result.state.cardSets[load.cardSetId];
          if (latest.current.storage && cardSet) void latest.current.storage.put('cardSet', cardSetItem(cardSet, r.merge.definitions)).catch(() => undefined);
          summaries.set(outcome.target.pileId, {
            fileName: load.source.name,
            pileName: outcome.target.pileName,
            cardCount: outcome.fetched.cards.length,
            added: r.merge.added.length,
            updated: r.merge.updated.length,
            missingNames: r.merge.definitions.filter((d) => d.missing).map((d) => d.front.name),
            problems: outcome.fetched.problems,
            shortfalls: r.shortfalls.map(({ name, extra }) => ({ name, extra })),
            fetchedAt,
          });
        });
      }

      if (failures.length > 0) {
        setErrors((errs) => ({ ...errs, ...Object.fromEntries(failures.flatMap((o) => (o.ok ? [] : [[`${startId}:${o.target.pileId}`, o.error]]))) }));
      }
      const items: SheetResultItem[] = current.map((o) => {
        const pile = live.session.piles.find((p) => p.id === o.target.pileId);
        const summary = o.ok ? summaries.get(o.target.pileId) : undefined;
        if (o.ok && summary) return { ok: true, pileName: o.target.pileName, summary };
        return { ok: false, pileName: o.target.pileName, sourceName: o.sourceName, error: o.ok ? '' : o.error, keepsData: (pile?.definitionIds.length ?? 0) > 0 };
      });
      const data: SheetResultsData = { kind, items };
      if (kind === 'reload') setResults(data);
      else {
        // At a start the dialog opens only when something needs a look, and never over a drag, a placement or another dialog.
        const { drag, placing } = store.getState();
        if (needsAttention(data) && !drag && !placing && !document.querySelector('dialog[open]')) setResults(data);
      }
    },
    [store, setFlight],
  );

  // A session start leaves its sheets in the store; fetch them once.
  useEffect(() => {
    const fetchPending = () => {
      const taken = store.getState().takeSheetLoad();
      if (taken) void runBatch('start', taken.targets);
    };
    // A start before this mounts left its sheets in the store; later ones arrive through the subscription.
    queueMicrotask(fetchPending);
    return store.subscribe((state, previous) => {
      if (state.pendingSheetLoad && state.pendingSheetLoad !== previous.pendingSheetLoad) fetchPending();
    });
  }, [store, runBatch]);

  const format = formatById(formats, session.formatId);
  const targets = useMemo(() => reloadAllTargets(session, format), [session, format]);

  const reloadAll = useCallback(async () => {
    const { session: now, sessionId: id } = store.getState();
    const list = reloadAllTargets(now, formatById(formats, now.formatId));
    if (list.length === 0) return;
    setReloadingIn(id);
    store.getState().announce(`Fetching ${list.length} ${list.length === 1 ? 'sheet' : 'sheets'}.`);
    try {
      await runBatch('reload', list);
    } finally {
      setReloadingIn((current) => (current === id ? undefined : current));
    }
  }, [store, formats, runBatch]);

  return {
    isFetching: (pileId: string) => flying.has(key(pileId)),
    anyFetching: flyingNow.length > 0,
    errorFor: (pileId: string): string | undefined => errors[key(pileId)],
    markFetching,
    setPileError,
    /** The format's default URL for a pile that has no card set yet (CD-12). */
    defaultUrlFor: (pileId: string): string | undefined => {
      const pile = session.piles.find((p) => p.id === pileId);
      return pile && pile.cardSetId === undefined ? format.piles.find((p) => p.id === pileId)?.sheetUrl : undefined;
    },
    canReloadAll: targets.length > 0,
    reloadingAll: reloadingIn === sessionId,
    reloadAll: () => void reloadAll(),
    results,
    closeResults: () => setResults(undefined),
  };
}
