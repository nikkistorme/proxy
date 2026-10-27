import { describe, expect, it } from 'vitest';
import type { SessionState } from '../model/session';
import { reorderHand } from './handActions';
import { draw } from './pileActions';
import { namesOf, sessionWithDeck } from './testing';

/** Imp, Ogre and Troll in Player 1's hand, in that order. */
function handSession(): SessionState {
  return draw(sessionWithDeck(), { pileId: 'pile-p1-main', count: 3 }).state;
}

const hand = (s: SessionState) => namesOf(s, s.hands['seat-p1']);
const idOf = (s: SessionState, name: string) => s.hands['seat-p1']?.find((id) => namesOf(s, [id])[0] === name) ?? '';

describe('TT-12 hand reordering', () => {
  it('moves a card to a new place, keeping the others in order', () => {
    const session = handSession();
    expect(hand(session)).toEqual(['Imp', 'Ogre', 'Troll']);
    const right = reorderHand(session, { seatId: 'seat-p1', cardId: idOf(session, 'Imp'), toIndex: 2 });
    expect(hand(right.state)).toEqual(['Ogre', 'Troll', 'Imp']);
    expect(right.announcement).toBe("Moved Imp to position 3 of 3 in Player 1's hand.");
    const left = reorderHand(session, { seatId: 'seat-p1', cardId: idOf(session, 'Troll'), toIndex: 1 });
    expect(hand(left.state)).toEqual(['Imp', 'Troll', 'Ogre']);
  });

  it('keeps the place within the hand', () => {
    const session = handSession();
    expect(hand(reorderHand(session, { seatId: 'seat-p1', cardId: idOf(session, 'Ogre'), toIndex: 9 }).state)).toEqual(['Imp', 'Troll', 'Ogre']);
    expect(hand(reorderHand(session, { seatId: 'seat-p1', cardId: idOf(session, 'Ogre'), toIndex: -1 }).state)).toEqual(['Ogre', 'Imp', 'Troll']);
  });

  it('leaves the session alone when the card is already there', () => {
    const session = handSession();
    const result = reorderHand(session, { seatId: 'seat-p1', cardId: idOf(session, 'Imp'), toIndex: -1 });
    expect(result.state).toBe(session);
    expect(result.announcement).toBe("Imp is already at position 1 of 3 in Player 1's hand.");
  });

  it('only reorders cards in that hand', () => {
    const session = handSession();
    expect(() => reorderHand(session, { seatId: 'seat-p1', cardId: 'nope', toIndex: 0 })).toThrow();
    expect(() => reorderHand(session, { seatId: 'seat-p1', cardId: idOf(session, 'Imp'), toIndex: 1.5 })).toThrow(RangeError);
  });
});
