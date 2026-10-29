import { describe, expect, it } from 'vitest';
import { createSession } from '../model/session';
import { SOLO_PVE } from '../model/format';
import { peekTop, reorderTop } from './peek';
import { sessionWithDeck, namesOf } from './testing';

const MAIN = 'pile-p1-main';
const deck = 'name\nImp\nOgre\nTroll\nWisp\n';

describe('SP-9 peek at the top cards', () => {
  it('returns the top N cards and names them, without changing anything', () => {
    const session = sessionWithDeck(deck);
    const { cardIds, announcement } = peekTop(session, { pileId: MAIN, count: 3 });
    expect(namesOf(session, cardIds)).toEqual(['Imp', 'Ogre', 'Troll']);
    expect(announcement).toBe('Top 3 of P1 main deck, top first: Imp, Ogre and Troll.');
  });

  it('returns what there is when the pile is short, and says when it is empty', () => {
    expect(peekTop(sessionWithDeck(deck), { pileId: MAIN, count: 10 }).cardIds).toHaveLength(4);
    expect(peekTop(createSession(SOLO_PVE), { pileId: MAIN, count: 2 })).toEqual({ cardIds: [], announcement: 'P1 main deck is empty.' });
    expect(() => peekTop(sessionWithDeck(deck), { pileId: MAIN, count: 0 })).toThrow(RangeError);
  });
});

describe('SP-9 reorder the top cards', () => {
  it('puts the top N back in the new order and leaves the rest', () => {
    const session = sessionWithDeck(deck);
    const [imp, ogre, troll] = peekTop(session, { pileId: MAIN, count: 3 }).cardIds as [string, string, string];
    const { state, announcement } = reorderTop(session, { pileId: MAIN, cardIds: [troll, imp, ogre] });
    expect(namesOf(state, state.piles.find((p) => p.id === MAIN)?.cardIds)).toEqual(['Troll', 'Imp', 'Ogre', 'Wisp']);
    expect(announcement).toBe('Put back the top 3 of P1 main deck, top first: Troll, Imp and Ogre.');
  });

  it('refuses cards that are not exactly the top N', () => {
    const session = sessionWithDeck(deck);
    const ids = session.piles.find((p) => p.id === MAIN)?.cardIds ?? [];
    const [imp, ogre, troll] = ids as [string, string, string];
    const message = /Reorder must use exactly the top/;
    expect(() => reorderTop(session, { pileId: MAIN, cardIds: [imp, troll] })).toThrow(message);
    expect(() => reorderTop(session, { pileId: MAIN, cardIds: [imp, imp] })).toThrow(message);
    expect(() => reorderTop(session, { pileId: MAIN, cardIds: [] })).toThrow(message);
    expect(() => reorderTop(session, { pileId: MAIN, cardIds: [...ids, ogre] })).toThrow(message);
  });
});
