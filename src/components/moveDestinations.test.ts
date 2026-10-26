import { describe, expect, it } from 'vitest';
import { moveCard } from '../actions/moveCard';
import { gameWithDeck } from '../actions/testing';
import { matchDestinations, moveDestinations } from './moveDestinations';

const game = gameWithDeck();
const topCard = game.piles[0]?.cardIds[0] ?? '';
const labels = (list: { label: string }[]) => list.map((o) => o.label);

describe('SP-8 move destinations', () => {
  it('lists the table, every hand, and the top and bottom of every pile, in that order', () => {
    const options = moveDestinations(game, topCard);
    expect(options.map((o) => [o.group, o.label, o.meta])).toEqual([
      ['Table', 'Table', '0 cards'],
      ['Hands', "Player 1's hand", '0 cards'],
      ['Piles', 'P1 main deck — top', '3 cards'],
      ['Piles', 'P1 main deck — bottom', '3 cards'],
      ['Piles', 'Environment deck — top', '0 cards'],
      ['Piles', 'Environment deck — bottom', '0 cards'],
      ['Piles', 'Board cards — top', '0 cards'],
      ['Piles', 'Board cards — bottom', '0 cards'],
    ]);
    expect(options.find((o) => o.label === 'Board cards — bottom')?.destination).toEqual({
      zone: 'pile',
      pileId: 'pile-board',
      position: 'bottom',
    });
    expect(options.find((o) => o.label === 'Environment deck — top')?.seatId).toBe('seat-env');
    expect(options.find((o) => o.label === 'Board cards — top')?.seatId).toBeUndefined();
  });

  it('leaves out the table or hand the card is already in', () => {
    const onTable = moveCard(game, { cardId: topCard, to: { zone: 'table' } }).state;
    expect(labels(moveDestinations(onTable, topCard))).not.toContain('Table');
    const inHand = moveCard(game, { cardId: topCard, to: { zone: 'hand', seatId: 'seat-p1' } }).state;
    const options = moveDestinations(inHand, topCard);
    expect(labels(options)).not.toContain("Player 1's hand");
    expect(labels(options)).toContain('Table');
  });

  it('matches the search anywhere in the label, ignoring case, and says where', () => {
    const options = moveDestinations(game, topCard);
    expect(matchDestinations(options, '  DECK — B ').map((m) => [m.option.label, m.hit])).toEqual([
      ['P1 main deck — bottom', [8, 16]],
      ['Environment deck — bottom', [12, 20]],
    ]);
    expect(matchDestinations(options, '')).toHaveLength(8);
    expect(matchDestinations(options, 'nowhere')).toEqual([]);
  });

  it("can leave out one pile's top, for peeking", () => {
    const options = labels(moveDestinations(game, topCard, { exceptTopOf: 'pile-p1-main' }));
    expect(options).not.toContain('P1 main deck — top');
    expect(options).toContain('P1 main deck — bottom');
    expect(options).toContain('Board cards — top');
  });
});
