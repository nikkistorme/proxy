/** A problem found while importing a CSV, shown to the user (CD-4). */
export interface ImportProblem {
  /** Spreadsheet row number: the header is row 1, the first card is row 2. */
  row: number;
  /** Normalised column name, when the problem belongs to one column. */
  column?: string;
  message: string;
}

/** One data row, keyed by normalised column name. */
export interface RawRow {
  row: number;
  values: Record<string, string>;
}

export interface ParsedCsv {
  /** Normalised column names, in file order, without duplicates or blanks. */
  columns: string[];
  rows: RawRow[];
  problems: ImportProblem[];
}
