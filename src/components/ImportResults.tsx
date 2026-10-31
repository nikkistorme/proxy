import { useId } from 'react';
import type { ImportProblem } from '../csv/types';
import { Dialog } from './Dialog';
import { formatFetchTime, GOOGLE_NOTE } from './fetchTime';
import './ImportResults.css';

export interface ImportSummary {
  fileName: string;
  /** Pile the deck was loaded into. */
  pileName?: string;
  /** Cards in this import, not counting back faces. */
  cardCount: number;
  added: number;
  updated: number;
  /** Names of cards no longer in the CSV. They stay in the deck, flagged missing. */
  missingNames: string[];
  problems: ImportProblem[];
  /** Cards with more copies in play than their new qty, because the extras aren't in the pile. */
  shortfalls?: { name: string; extra: number }[];
  /** When a URL's cards were fetched, in ms (CD-9). */
  fetchedAt?: number;
}

interface ImportResultsProps {
  summary: ImportSummary | undefined;
  onClose: () => void;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Import results dialog (CD-4): what imported, and every problem by row and column. */
export function ImportResults({ summary, onClose }: ImportResultsProps) {
  const problemsId = useId();

  const parts = summary
    ? [plural(summary.cardCount, 'card', 'cards') + ' imported', `${summary.added} new`, `${summary.updated} updated`]
    : [];
  if (summary?.missingNames.length) parts.push(`${summary.missingNames.length} missing`);

  return (
    <Dialog
      open={summary !== undefined}
      title="Import results"
      eyebrow={summary && (summary.pileName ? `${summary.fileName} into ${summary.pileName}` : summary.fileName)}
      hint="Esc close"
      onClose={onClose}
      primaryLabel="Done"
    >
      {summary && (
        <>
          <p className="import-results__summary">{parts.join(' · ')}</p>
          {summary.fetchedAt !== undefined && (
            <p className="import-results__missing">
              Fetched {formatFetchTime(summary.fetchedAt)}. {GOOGLE_NOTE}
            </p>
          )}
          {summary.missingNames.length > 0 && (
            <p className="import-results__missing">
              No longer in the CSV, kept in the deck: {summary.missingNames.join(', ')}
            </p>
          )}

          {summary.shortfalls && summary.shortfalls.length > 0 && (
            <p className="import-results__missing">
              More copies in play than the new qty, so these stay:{' '}
              {summary.shortfalls.map((s) => `${s.name} (${plural(s.extra, 'extra copy', 'extra copies')})`).join(', ')}
            </p>
          )}

          <h3 id={problemsId} className="import-results__subtitle">
            {summary.problems.length === 0 ? 'No problems found' : plural(summary.problems.length, 'problem', 'problems')}
          </h3>
          {summary.problems.length > 0 && (
            <div className="import-results__table-wrap">
              <table className="import-results__table" aria-labelledby={problemsId}>
                <thead>
                  <tr>
                    <th scope="col">Row</th>
                    <th scope="col">Column</th>
                    <th scope="col">Problem</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.problems.map((problem, index) => (
                    <tr key={index}>
                      <td className="import-results__num">{problem.row}</td>
                      <td>{problem.column ?? '—'}</td>
                      <td>{problem.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Dialog>
  );
}
