import { useEffect, useId, useRef } from 'react';
import type { ImportProblem } from '../csv/types';
import './ImportResults.css';

export interface ImportSummary {
  fileName: string;
  /** Cards in this import, not counting back faces. */
  cardCount: number;
  added: number;
  updated: number;
  /** Names of cards no longer in the CSV. They stay in the deck, flagged missing. */
  missingNames: string[];
  problems: ImportProblem[];
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const problemsId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (summary && !dialog.open) dialog.showModal();
    if (!summary && dialog.open) dialog.close();
  }, [summary]);

  const parts = summary
    ? [plural(summary.cardCount, 'card', 'cards') + ' imported', `${summary.added} new`, `${summary.updated} updated`]
    : [];
  if (summary?.missingNames.length) parts.push(`${summary.missingNames.length} missing`);

  return (
    // Esc fires the dialog's close event, which reports back through onClose.
    <dialog ref={dialogRef} className="import-results" aria-labelledby={titleId} onClose={onClose}>
      {summary && (
        <>
          <div className="import-results__header">
            <div className="import-results__titles">
              <span className="import-results__eyebrow">{summary.fileName}</span>
              <h2 id={titleId} className="import-results__title">
                Import results
              </h2>
            </div>
            <button type="button" className="icon-button" aria-label="Close" onClick={() => dialogRef.current?.close()}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <div className="import-results__body">
            <p className="import-results__summary">{parts.join(' · ')}</p>
            {summary.missingNames.length > 0 && (
              <p className="import-results__missing">
                No longer in the CSV, kept in the deck: {summary.missingNames.join(', ')}
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
          </div>

          <div className="import-results__footer">
            <span className="import-results__hint">Esc close</span>
            <button type="button" className="button button--primary" onClick={() => dialogRef.current?.close()}>
              Done
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
