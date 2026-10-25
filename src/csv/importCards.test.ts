import { describe, expect, it } from 'vitest';
import doubleFaced from '../../tests/fixtures/csv/double-faced.csv?raw';
import importErrors from '../../tests/fixtures/csv/import-errors.csv?raw';
import sixtyRows from '../../tests/fixtures/csv/sixty-rows-two-dfc.csv?raw';
import { importCards } from './importCards';

describe('CD-3 double-faced cards', () => {
  it('attaches a back_of row to its front as the second face', () => {
    const { cards, problems } = importCards(doubleFaced);
    expect(problems).toEqual([]);
    const vault = cards.find((c) => c.sourceId === 'vault');
    expect(vault).toEqual({
      row: 5,
      sourceId: 'vault',
      qty: 1,
      front: { name: 'Locked Vault', type: 'Location', fields: { rules: 'Locked.' } },
      back: { name: 'Open Vault', type: 'Location', fields: { rules: 'Open.' } },
    });
  });

  it('does not add back faces to the deck as cards of their own', () => {
    const { cards } = importCards(doubleFaced);
    expect(cards.map((c) => c.front.name)).toEqual(['Daylight Hunter', 'Ember Shard', 'Locked Vault']);
  });

  it('attaches a back face that comes before its front in the file', () => {
    const hunter = importCards(doubleFaced).cards.find((c) => c.sourceId === 'hunter');
    expect(hunter?.qty).toBe(2);
    expect(hunter?.back?.name).toBe('Moonrise Hunter');
  });

  it('leaves single-faced cards without a back', () => {
    const shard = importCards(doubleFaced).cards.find((c) => c.front.name === 'Ember Shard');
    expect(shard).not.toHaveProperty('back');
  });

  it('acceptance: 60 rows with two double-faced pairs import as 58 cards, two with a back face', () => {
    const { cards, problems } = importCards(sixtyRows);
    expect(problems).toEqual([]);
    expect(cards).toHaveLength(58);
    expect(cards.filter((c) => c.back).map((c) => [c.front.name, c.back?.name])).toEqual([
      ['Daybreak Wolf', 'Nightfall Wolf'],
      ['Sealed Gate', 'Open Gate'],
    ]);
    const gate = cards.find((c) => c.sourceId === 'gate');
    expect(gate?.back?.fields.rules).toBe('Open.\nAnything passes.');
  });
});

describe('CD-3 card fields', () => {
  it('trims the named columns and keeps other columns exactly as written', () => {
    const [card] = importCards(
      'name,image,layout,type,qty,rules\n  Imp  , https://x.test/imp.png , Small ,  Creature , 3 ,"  Spaced  rules "\n',
    ).cards;
    expect(card).toEqual({
      row: 2,
      qty: 3,
      front: {
        name: 'Imp',
        image: 'https://x.test/imp.png',
        layout: 'Small',
        type: 'Creature',
        fields: { rules: '  Spaced  rules ' },
      },
    });
  });

  it('treats blank optional columns as unset and a blank qty as 1', () => {
    const [card] = importCards('name,image,layout,type,qty\nImp, , , ,\n').cards;
    expect(card).toEqual({ row: 2, qty: 1, front: { name: 'Imp', fields: {} } });
  });

  it('imports a card even when the file has no qty column', () => {
    expect(importCards('name\nImp\n').cards).toEqual([{ row: 2, qty: 1, front: { name: 'Imp', fields: {} } }]);
  });
});

describe('CD-4 import problems', () => {
  const { cards, problems } = importCards(importErrors);
  const named = (name: string) => cards.find((c) => c.front.name === name);

  it('reports every problem with its row, column and what is wrong, in row order', () => {
    expect(problems).toEqual([
      { row: 2, column: 'name', message: 'Missing name.' },
      { row: 3, column: 'qty', message: `qty "two" isn't a whole number. Imported 1 copy.` },
      { row: 4, column: 'id', message: 'id "gob" is already used on row 3.' },
      { row: 5, column: 'back_of', message: 'No card has id "nobody".' },
      { row: 8, column: 'back_of', message: 'Card "Troll" already has a back face on row 7.' },
      { row: 9, column: 'back_of', message: 'Row 7 is itself a back face.' },
      {
        row: 10,
        column: 'name',
        message: 'Row 3 has the same name. Re-importing will match row 3; add an id to tell them apart.',
      },
      { row: 11, column: 'name', message: 'Missing name.' },
    ]);
  });

  it('still imports every valid row', () => {
    expect(cards.map((c) => c.row)).toEqual([3, 4, 6, 10]);
  });

  it('imports a row with a bad qty as one copy', () => {
    expect(named('Goblin')?.qty).toBe(1);
  });

  it('allows qty 0', () => {
    expect(named('Troll')?.qty).toBe(0);
  });

  it('imports a row with a duplicate id without that id', () => {
    expect(named('Hobgoblin')).not.toHaveProperty('sourceId');
    expect(named('Goblin')?.sourceId).toBe('gob');
  });

  it('keeps the first back face when a front has two', () => {
    expect(named('Troll')?.back?.name).toBe('Troll Back');
  });

  it('imports both cards that share a name', () => {
    expect(cards.filter((c) => c.front.name.trim().toLowerCase() === 'goblin')).toHaveLength(2);
  });

  it('does not report a shared name when both cards have ids', () => {
    expect(importCards('name,id\nImp,a\nimp,b\n').problems).toEqual([]);
  });

  it('includes problems from parsing the file', () => {
    expect(importCards('').problems).toEqual([{ row: 1, message: 'The file is empty or has no header row.' }]);
  });
});
