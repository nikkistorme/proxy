import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { importCards } from '../csv/importCards';
import { readLayoutFile } from '../model/layoutFile';

const here = (file: string) => resolve(__dirname, file);
const read = (file: string) => readFileSync(here(file), 'utf8');
const decks = ['emberguard', 'tidewardens', 'the-fog', 'harbour-board'] as const;
const imported: Record<(typeof decks)[number], ReturnType<typeof importCards>> = {
  emberguard: importCards(read('emberguard.csv')),
  tidewardens: importCards(read('tidewardens.csv')),
  'the-fog': importCards(read('the-fog.csv')),
  'harbour-board': importCards(read('harbour-board.csv')),
};
const total = (deck: (typeof decks)[number]) => imported[deck].cards.reduce((sum, card) => sum + card.qty, 0);
const layoutFile = readLayoutFile(read('layouts.json'));
const layouts = 'layouts' in layoutFile ? layoutFile.layouts : [];
const faces = Object.values(imported).flatMap(({ cards }) => cards.flatMap((card) => (card.back ? [card.front, card.back] : [card.front])));

describe('DM-1 demo decks', () => {
  it.each(decks)('%s imports with no problems', (deck) => {
    expect(imported[deck].problems).toEqual([]);
  });

  it('has two player decks of about 30 cards, one environment deck and 6 board cards', () => {
    expect(total('emberguard')).toBe(30);
    expect(total('tidewardens')).toBe(30);
    expect(total('the-fog')).toBe(20);
    expect(total('harbour-board')).toBe(6);
  });
});

describe('DM-2 demo layouts', () => {
  it('loads three layouts through the layout file reader, in both orientations', () => {
    expect('layouts' in layoutFile).toBe(true);
    expect(layouts.map((layout) => layout.name)).toEqual(['Demo creature', 'Demo action', 'Demo location']);
    expect(layouts.map((layout) => layout.orientation)).toEqual(['portrait', 'portrait', 'landscape']);
  });

  it('every card face names a demo layout', () => {
    const names = new Set(layouts.map((layout) => layout.name));
    for (const face of faces) expect(names.has(face.layout ?? ''), `${face.name}: ${face.layout}`).toBe(true);
  });

  it('draws the board with the landscape layout', () => {
    for (const card of imported['harbour-board'].cards) expect(card.front.layout).toBe('Demo location');
  });
});

describe('DM-3 double-faced demo cards', () => {
  it('has a back face on Tide Caller and Rolling Bank', () => {
    const backOf = (deck: (typeof decks)[number], name: string) => imported[deck].cards.find((card) => card.front.name === name)?.back?.name;
    expect(backOf('tidewardens', 'Tide Caller')).toBe('Ebb Caller');
    expect(backOf('the-fog', 'Rolling Bank')).toBe('Clearing Bank');
  });
});

describe('DM-4 demo art', () => {
  const images = faces.map((face) => face.image ?? '');

  it('names an art file for every face, and every file exists under public/', () => {
    for (const image of images) {
      expect(image, 'image').toMatch(/^demo\/art\/[a-z-]+\.svg$/);
      expect(existsSync(here(`../../public/${image}`)), image).toBe(true);
    }
  });

  it('keeps art files free of external references', () => {
    for (const image of images) expect(readFileSync(here(`../../public/${image}`), 'utf8')).not.toMatch(/https?:\/\/(?!www\.w3\.org\/2000\/svg)|href=/);
  });

  it('lists every art file in CREDITS.md', () => {
    const credits = read('CREDITS.md');
    for (const image of images) expect(credits, image).toContain(`\`${image.replace('demo/art/', '')}\``);
  });
});
