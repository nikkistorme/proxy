import { describe, expect, it } from 'vitest';
import { gameWithDeck } from '../actions/testing';
import { filterColumns, filterEntries, pileEntries } from './pileFilter';

const csv = `name,type,cost,faction,rules
Ember Scout,Unit,2,Ember,Look at the top card of any pile.
Tide Caller,Unit,10,Tide,Draw a card.
Emberline Courier,Unit,1,Ember,Draw a card if a Location is in play.
Kindle Ward,Ward,1,Ember,Prevent the first 2 damage.
Banked Coals,Tactic,0,,Gain 2 Energy from embers.
`;

const game = gameWithDeck(csv);
const entries = pileEntries(game, 'pile-p1-main');
const names = (list: typeof entries) => list.map((e) => e.face.name);

describe('SP-7 pile viewer search and filters', () => {
  it('lists every card top first, with its position', () => {
    expect(names(entries)).toEqual(['Ember Scout', 'Tide Caller', 'Emberline Courier', 'Kindle Ward', 'Banked Coals']);
    expect(entries.map((e) => e.position)).toEqual([1, 2, 3, 4, 5]);
    expect(pileEntries(game, 'pile-env')).toEqual([]);
  });

  it('searches the name and every column, ignoring case and surrounding spaces', () => {
    expect(names(filterEntries(entries, { search: '  EMBER ', filters: {} }))).toEqual([
      'Ember Scout',
      'Emberline Courier',
      'Kindle Ward',
      'Banked Coals',
    ]);
    expect(names(filterEntries(entries, { search: 'tactic', filters: {} }))).toEqual(['Banked Coals']);
    expect(filterEntries(entries, { search: 'nothing like this', filters: {} })).toEqual([]);
  });

  it('offers a filter for type and short columns, but not free text', () => {
    expect(filterColumns(entries)).toEqual([
      { column: 'type', label: 'Type', values: ['Tactic', 'Unit', 'Ward'] },
      { column: 'cost', label: 'Cost', values: ['0', '1', '2', '10'] },
      { column: 'faction', label: 'Faction', values: ['Ember', 'Tide'] },
    ]);
  });

  it('skips columns with one value or more than 12', () => {
    const many = Array.from({ length: 13 }, (_, i) => `Card ${i},same,${i}`).join('\n');
    const columns = filterColumns(pileEntries(gameWithDeck(`name,set,number\n${many}\n`), 'pile-p1-main'));
    expect(columns.map((c) => c.column)).toEqual([]);
  });

  it('combines filters with search, and a blank filter means any', () => {
    const query = { search: 'draw', filters: { faction: 'Ember', type: '' } };
    expect(names(filterEntries(entries, query))).toEqual(['Emberline Courier']);
    expect(names(filterEntries(entries, { search: '', filters: { type: 'Unit', cost: '1' } }))).toEqual(['Emberline Courier']);
  });
});
