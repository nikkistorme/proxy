import { describe, expect, it } from 'vitest';
import { moveCard } from '../actions/moveCard';
import { cardsFrom, testContext } from '../actions/testing';
import { loadPile } from '../actions/loadPile';
import type { CardSide, GameState, Rotation } from '../model/game';
import { createSoloGame } from '../model/game';
import { tableCardView } from './tableCardView';

const csv = 'name,id,back_of\nTroll,,\nMoonrise Hunter,,hunter\nDaylight Hunter,hunter,\n';

/** One card on the table, with its side, rotation and definition changed as given. */
function viewOf(name: string, side: CardSide, rotation: Rotation = 0, change: (g: GameState, definitionId: string) => GameState = (g) => g) {
  let game = loadPile(createSoloGame(), { pileId: 'pile-p1-main', sourceName: 'd.csv', cards: cardsFrom(csv), keepOrder: true }, testContext()).state;
  const card = Object.values(game.cards).find((c) => game.definitions[c.definitionId]?.front.name === name);
  if (!card) throw new Error(name);
  game = moveCard(game, { cardId: card.id, to: { zone: 'table' } }).state;
  game = { ...game, cards: { ...game.cards, [card.id]: { ...card, side } }, table: game.table.map((e) => ({ ...e, rotation })) };
  game = change(game, card.definitionId);
  const entry = game.table[0];
  if (!entry) throw new Error('Nothing on the table');
  return tableCardView(game, entry);
}

describe('A11Y-6 table card names', () => {
  it('names a single-faced card by its name, and adds its rotation', () => {
    expect(viewOf('Troll', 'front').label).toBe('Troll');
    expect(viewOf('Troll', 'front', 90).label).toBe('Troll, rotated 90°');
  });

  it('says which face of a double-faced card shows', () => {
    expect(viewOf('Daylight Hunter', 'front').label).toBe('Daylight Hunter, front face');
    const back = viewOf('Daylight Hunter', 'back', 180);
    expect(back.label).toBe('Moonrise Hunter, back face, rotated 180°');
    expect(back.face?.name).toBe('Moonrise Hunter');
  });

  it("names a face-down card only by its owner's seat, and shows no face", () => {
    const down = viewOf('Daylight Hunter', 'down', 270);
    expect(down.label).toBe('Face-down card, Player 1, rotated 270°');
    expect(down.face).toBeUndefined();
    expect(down.ownerSeatId).toBe('seat-p1');
  });

  it('falls back to the front when the back was lost on re-import', () => {
    const view = viewOf('Daylight Hunter', 'back', 0, (g, id) => {
      const definitions = { ...g.definitions };
      const definition = definitions[id];
      if (definition) definitions[id] = { ...definition, back: undefined };
      return { ...g, definitions };
    });
    expect(view.face?.name).toBe('Daylight Hunter');
    expect(view.label).toBe('Daylight Hunter');
  });

  it('flags a card that is no longer in its CSV', () => {
    const view = viewOf('Troll', 'front', 0, (g, id) => {
      const definition = g.definitions[id];
      return definition ? { ...g, definitions: { ...g.definitions, [id]: { ...definition, missing: true } } } : g;
    });
    expect(view.missing).toBe(true);
    expect(view.label).toBe('Troll, not in the CSV any more');
  });
});
