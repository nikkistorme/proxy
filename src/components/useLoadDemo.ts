import { useCallback, useEffect, useRef } from 'react';
import { loadDemoData } from '../demo/loadDemoData';
import { loadDemo } from '../actions/loadDemo';
import { importCards } from '../csv/importCards';
import { useLayouts } from '../layouts/LayoutsProvider';
import { cardSetItem } from '../model/cardSet';
import { COOP_PVE } from '../model/format';
import { layoutNameKey } from '../model/layoutChoice';
import { useStorage } from '../storage/StorageProvider';
import { useSessionStoreApi } from '../store/sessionStore';

export type DemoData = typeof import('../demo/demoData');

/**
 * DM-5: the Load demo button's work. `fetchDemo` downloads the demo chunk (and waits for the
 * saved layouts to be read, so an edited demo layout is never overwritten); `startDemo` then
 * saves the layouts, starts Co-op PvE and fills the piles in one action.
 */
export function useLoadDemo() {
  const store = useSessionStoreApi();
  const storage = useStorage();
  const { layouts, loaded, saveLayout } = useLayouts();
  const latest = useRef({ layouts, loaded, saveLayout, storage });
  const waiting = useRef<(() => void)[]>([]);
  useEffect(() => {
    latest.current = { layouts, loaded, saveLayout, storage };
    if (loaded) waiting.current.splice(0).forEach((resolve) => resolve());
  });

  const fetchDemo = useCallback(async (): Promise<DemoData> => {
    const layoutsRead = latest.current.loaded ? Promise.resolve() : new Promise<void>((resolve) => waiting.current.push(resolve));
    const [data] = await Promise.all([loadDemoData(), layoutsRead]);
    return data;
  }, []);

  const startDemo = useCallback(
    (data: DemoData) => {
      const { layouts: saved, saveLayout: save, storage: backend } = latest.current;
      // A demo layout is kept if its id or name is already there: an edited one stays, a deleted one comes back.
      for (const layout of data.DEMO_LAYOUTS) {
        if (!saved.some((own) => own.id === layout.id || layoutNameKey(own.name) === layoutNameKey(layout.name))) save(layout);
      }
      const { startSession, dispatch } = store.getState();
      startSession(COOP_PVE, { silent: true });
      const result = dispatch((session, context) =>
        loadDemo(
          session,
          { piles: data.DEMO_PILES.map((pile) => ({ pileId: pile.pileId, cardSetId: pile.cardSetId, source: { kind: 'file', name: pile.fileName }, cards: importCards(pile.csv).cards, keepOrder: pile.keepOrder })) },
          context,
        ),
      );
      result.results.forEach((r, index) => {
        const id = data.DEMO_PILES[index]?.cardSetId;
        const cardSet = id ? result.state.cardSets[id] : undefined;
        // The session has its own copy of the cards, so play goes on if the save fails (AR-4, PS-6).
        if (backend && cardSet) void backend.put('cardSet', cardSetItem(cardSet, r.merge.definitions)).catch(() => undefined);
      });
    },
    [store],
  );

  return { fetchDemo, startDemo };
}
