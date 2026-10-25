import Papa from 'papaparse';
import type { ImportProblem, ParsedCsv, RawRow } from './types';

/** CD-2: column names are case-insensitive and ignore surrounding whitespace. */
export function normaliseColumnName(name: string): string {
  return name.trim().toLowerCase();
}

function isBlankRecord(record: string[]): boolean {
  return record.every((field) => field.trim() === '');
}

/**
 * Parses CSV text with a header row (CD-1, CD-2).
 *
 * Records are parsed without Papa's header mode so each record's index maps
 * straight to its spreadsheet row, even when quoted fields contain line breaks.
 */
export function parseCsv(text: string): ParsedCsv {
  const problems: ImportProblem[] = [];
  const result = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), {
    delimiter: ',',
    skipEmptyLines: false,
  });

  // Papa reports quote problems against the record index; a broken record is dropped.
  const brokenRecords = new Set<number>();
  for (const error of result.errors) {
    if (error.type !== 'Quotes' || error.row === undefined) continue;
    brokenRecords.add(error.row);
    problems.push({ row: error.row + 1, message: `Couldn't read this row: ${error.message}.` });
  }

  const [header, ...records] = result.data;
  if (!header || isBlankRecord(header)) {
    return { columns: [], rows: [], problems: [{ row: 1, message: 'The file is empty or has no header row.' }] };
  }

  // Map each header position to a column name, skipping blanks and duplicates.
  const columns: string[] = [];
  const columnAt: (string | undefined)[] = header.map((raw) => {
    const name = normaliseColumnName(raw);
    if (name === '') return undefined;
    if (columns.includes(name)) {
      problems.push({ row: 1, column: name, message: `Column "${name}" appears more than once. Only the first is used.` });
      return undefined;
    }
    columns.push(name);
    return name;
  });

  const rows: RawRow[] = [];
  records.forEach((record, index) => {
    const row = index + 2;
    if (brokenRecords.has(index + 1) || isBlankRecord(record)) return;

    if (record.length > header.length) {
      problems.push({
        row,
        message: `Row has ${record.length} values but the header has ${header.length} columns. Extra values are ignored.`,
      });
    }

    const values: Record<string, string> = {};
    columnAt.forEach((name, position) => {
      if (name !== undefined) values[name] = record[position] ?? '';
    });
    rows.push({ row, values });
  });

  problems.sort((a, b) => a.row - b.row);
  return { columns, rows, problems };
}
