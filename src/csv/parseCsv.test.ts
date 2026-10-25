import { describe, expect, it } from 'vitest';
import basic from '../../tests/fixtures/csv/basic.csv?raw';
import malformed from '../../tests/fixtures/csv/malformed.csv?raw';
import messyHeaders from '../../tests/fixtures/csv/messy-headers.csv?raw';
import quotedFields from '../../tests/fixtures/csv/quoted-fields.csv?raw';
import unclosedQuote from '../../tests/fixtures/csv/unclosed-quote.csv?raw';
import utf8 from '../../tests/fixtures/csv/utf8.csv?raw';
import { normaliseColumnName, parseCsv } from './parseCsv';

describe('CD-1 CSV parsing', () => {
  it('reads a header row and one row per card, numbered as in the spreadsheet', () => {
    const { columns, rows, problems } = parseCsv(basic);
    expect(columns).toEqual(['name', 'qty', 'type']);
    expect(rows).toEqual([
      { row: 2, values: { name: 'Goblin', qty: '2', type: 'Creature' } },
      { row: 3, values: { name: 'Fireball', qty: '1', type: 'Spell' } },
      { row: 4, values: { name: 'Forest', qty: '', type: 'Land' } },
    ]);
    expect(problems).toEqual([]);
  });

  it('keeps commas, line breaks and escaped quotes inside quoted fields', () => {
    const { rows, problems } = parseCsv(quotedFields);
    expect(rows[0]).toEqual({
      row: 2,
      values: { name: 'Wall, Stone', rules: "Defender.\nCan't attack.", flavor: 'He said "halt" and meant it.' },
    });
    // The multi-line field doesn't shift the next row's number.
    expect(rows[1]).toEqual({ row: 3, values: { name: 'Plain Card', rules: 'No quotes here', flavor: '' } });
    expect(problems).toEqual([]);
  });

  it('reads UTF-8 text and ignores a byte-order mark', () => {
    const { columns, rows } = parseCsv(utf8);
    expect(columns).toEqual(['name', 'rules']);
    expect(rows.map((r) => r.values)).toEqual([
      { name: 'Élan Vital', rules: 'Gain ✦ 2 — then draw.' },
      { name: '火の精霊', rules: 'Deal 3 damage. 🔥' },
    ]);
  });

  it('strips a byte-order mark even when the fixture loader drops it', () => {
    expect(parseCsv('\uFEFFname\nImp\n').columns).toEqual(['name']);
  });

  it('reads Windows line endings', () => {
    expect(parseCsv('name,qty\r\nImp,1\r\n').rows).toEqual([{ row: 2, values: { name: 'Imp', qty: '1' } }]);
  });

  it('skips blank lines but keeps later row numbers matching the spreadsheet', () => {
    const { rows } = parseCsv(malformed);
    expect(rows.map((r) => r.row)).toEqual([2, 4, 5]);
  });

  it('fills missing trailing values with empty strings', () => {
    const imp = parseCsv(malformed).rows.find((r) => r.row === 5);
    expect(imp?.values).toEqual({ name: 'Imp', qty: '', type: '' });
  });

  it('reports a row with more values than columns and still imports it', () => {
    const { rows, problems } = parseCsv(malformed);
    expect(rows.find((r) => r.row === 4)?.values).toEqual({ name: 'Troll', qty: '1', type: 'Creature' });
    expect(problems).toContainEqual({
      row: 4,
      message: 'Row has 5 values but the header has 4 columns. Extra values are ignored.',
    });
  });

  it('reports an unclosed quote, drops that row and keeps the rows before it', () => {
    const { rows, problems } = parseCsv(unclosedQuote);
    expect(rows).toEqual([{ row: 2, values: { name: 'Good Card', rules: 'Fine' } }]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ row: 3 });
    expect(problems[0]?.message).toMatch(/^Couldn't read this row/);
  });

  it('reports an empty file', () => {
    for (const text of ['', '\n\n', ' , \n']) {
      expect(parseCsv(text)).toEqual({
        columns: [],
        rows: [],
        problems: [{ row: 1, message: 'The file is empty or has no header row.' }],
      });
    }
  });

  it('accepts a header with no data rows', () => {
    expect(parseCsv('name,qty\n')).toEqual({ columns: ['name', 'qty'], rows: [], problems: [] });
  });
});

describe('CD-2 column names', () => {
  it('normalises case and surrounding whitespace', () => {
    expect(normaliseColumnName('  Rules Text ')).toBe('rules text');
    expect(normaliseColumnName('QTY')).toBe('qty');
  });

  it('matches columns regardless of case and whitespace, and ignores blank headers', () => {
    const { columns, rows, problems } = parseCsv(messyHeaders);
    expect(columns).toEqual(['name', 'qty', 'rules text', 'type']);
    expect(rows[0]?.values).toEqual({ name: 'Goblin', qty: '2', 'rules text': 'Haste', type: 'Creature' });
    expect(problems).toEqual([]);
  });

  it('reports a column that repeats after normalising and keeps the first', () => {
    const { columns, rows, problems } = parseCsv(malformed);
    expect(columns).toEqual(['name', 'qty', 'type']);
    expect(rows[0]?.values.name).toBe('Goblin');
    expect(problems[0]).toEqual({
      row: 1,
      column: 'name',
      message: 'Column "name" appears more than once. Only the first is used.',
    });
  });
});
