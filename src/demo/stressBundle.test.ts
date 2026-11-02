import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { importCards } from '../csv/importCards';
import { bundleToText, readBundle } from '../model/bundle';
import { makeStressBundle, makeTwoHundredRows } from './stressBundle';

const fixture = (file: string) => readFileSync(resolve(__dirname, '../../tests/fixtures', file), 'utf8');

describe('Performance stress table fixture', () => {
  const text = fixture('bundles/stress.json');

  it('matches its builder, so `npm run perf:fixture` regenerates it', () => {
    expect(text).toBe(bundleToText(makeStressBundle()));
  });

  it('loads through readBundle with two 60-card decks, a 40-card pile and 80 cards in play', () => {
    const result = readBundle(text);
    if ('error' in result) throw new Error(result.error);
    const { state } = result.bundle.session;
    expect(state.piles.map((pile) => pile.cardIds.length)).toEqual([60, 60, 40, 0]);
    expect(state.table).toHaveLength(80);
    expect(result.bundle.layouts.length).toBeGreaterThan(0);
  });

  it('has art on every card in play, from the demo art in public/', () => {
    const result = readBundle(text);
    if ('error' in result) throw new Error(result.error);
    const { state } = result.bundle.session;
    for (const entry of state.table) {
      const image = state.definitions[state.cards[entry.cardId]?.definitionId ?? '']?.front.image ?? '';
      expect(existsSync(resolve(__dirname, '../../public', image)), image).toBe(true);
    }
  });
});

describe('Performance 200-row CSV fixture', () => {
  it('matches its builder and imports 200 cards', () => {
    const text = fixture('csv/two-hundred-rows.csv');
    expect(text).toBe(makeTwoHundredRows());
    const { cards } = importCards(text);
    expect(cards).toHaveLength(200);
  });
});
