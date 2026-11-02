import { loadDemo } from '../actions/loadDemo';
import { importCards } from '../csv/importCards';
import { BUNDLE_APP, type Bundle } from '../model/bundle';
import type { ImportedCard } from '../model/card';
import { cardSetItem } from '../model/cardSet';
import { COOP_PVE } from '../model/format';
import { seededRandomInt } from '../model/random';
import { createSession, type Rotation, type TableEntry } from '../model/session';
import { CARD_H, CARD_W, TABLE_GAP } from '../model/tablePlacement';
import { SAVE_VERSION } from '../storage/storage';
import { DEMO_LAYOUTS, DEMO_PILES } from './demoData';

/** Cards left in each pile, and cards taken from it onto the table: 80 in play in all. */
const PILE_PLAN: Record<string, { pile: number; table: number }> = {
  'pile-p1-main': { pile: 60, table: 30 },
  'pile-p2-main': { pile: 60, table: 30 },
  'pile-env': { pile: 40, table: 14 },
  'pile-board': { pile: 0, table: 6 },
};

const TABLE_COLUMNS = 10;
/** Below the piles along the top of the table. */
const TABLE_TOP = TABLE_GAP * 2 + CARD_H;

/** Raises the demo deck's quantities, one card at a time in CSV order, until it has `total` cards. */
function scaled(cards: readonly ImportedCard[], total: number): ImportedCard[] {
  const qty = cards.map(() => 0);
  for (let i = 0; i < total; i++) qty[i % cards.length] = (qty[i % cards.length] ?? 0) + 1;
  return cards.map((card, index) => ({ ...card, qty: qty[index] ?? 0 }));
}

/**
 * The stress table from the Performance section (8d, #171): Co-op PvE with two 60-card
 * decks, a 40-card environment deck and 80 cards in play, all from the demo game with
 * its art and layouts. Fixed ids and seed, so the fixture is the same every time.
 */
export function makeStressBundle(): Bundle {
  let next = 0;
  const context = { randomInt: seededRandomInt(171), newId: () => `stress-${String(++next).padStart(4, '0')}` };
  const loads = DEMO_PILES.map((pile) => {
    const plan = PILE_PLAN[pile.pileId] ?? { pile: 0, table: 0 };
    const cards = scaled(importCards(pile.csv).cards, plan.pile + plan.table);
    return { pileId: pile.pileId, cardSetId: pile.cardSetId, source: { kind: 'file' as const, name: pile.fileName }, cards, keepOrder: pile.keepOrder };
  });
  const loaded = loadDemo(createSession(COOP_PVE), { piles: loads }, context);
  let state = loaded.state;

  // Take each pile's top cards onto the table in a grid, face up, with a few turned or carrying counters.
  const table: TableEntry[] = [];
  const cards = { ...state.cards };
  const piles = state.piles.map((pile) => {
    const take = PILE_PLAN[pile.id]?.table ?? 0;
    for (const cardId of pile.cardIds.slice(0, take)) {
      const index = table.length;
      const rotation: Rotation = index % 9 === 4 ? 90 : 0;
      const entry: TableEntry = {
        cardId,
        x: TABLE_GAP + (index % TABLE_COLUMNS) * (CARD_W + TABLE_GAP) + (rotation ? (CARD_H - CARD_W) / 2 : 0),
        y: TABLE_TOP + Math.floor(index / TABLE_COLUMNS) * (CARD_H + TABLE_GAP),
        rotation,
      };
      if (index % 7 === 3) entry.counters = [{ id: `${cardId}-damage`, name: 'Damage', value: (index % 4) + 1 }];
      table.push(entry);
      const card = cards[cardId];
      if (card) cards[cardId] = { ...card, side: index % 11 === 10 ? 'down' : 'front' };
    }
    return { ...pile, cardIds: pile.cardIds.slice(take) };
  });
  state = { ...state, cards, piles, table };

  return {
    app: BUNDLE_APP,
    version: SAVE_VERSION,
    exportedAt: '2026-11-02T00:00:00.000Z',
    session: { id: 'stress-session', state, log: [], zoom: 1, snap: false },
    snapshots: [],
    cardSets: loaded.results.map((result, index) => {
      const id = loads[index]?.cardSetId ?? '';
      const summary = state.cardSets[id];
      if (!summary) throw new Error(`No card set ${id}`);
      return cardSetItem(summary, result.merge.definitions);
    }),
    layouts: [...DEMO_LAYOUTS],
    formats: [],
    settings: { id: 'account', options: {} },
  };
}

/**
 * The 200-row CSV import from the Performance section: the demo decks' rows repeated
 * with numbered names and their art, one copy each, so every row is its own card.
 */
export function makeTwoHundredRows(): string {
  const rows = DEMO_PILES.flatMap((pile) => importCards(pile.csv).cards.filter((card) => !card.back));
  const lines = ['name,qty,type,layout,image,cost,rules,stats'];
  const quote = (text: string) => (/[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);
  for (let i = 0; i < 200; i++) {
    const { front } = rows[i % rows.length] as ImportedCard;
    const f = front.fields;
    lines.push([`${front.name} ${i + 1}`, '1', front.type ?? '', front.layout ?? '', front.image ?? '', f.cost ?? '', f.rules ?? '', f.stats ?? ''].map(quote).join(','));
  }
  return `${lines.join('\n')}\n`;
}
