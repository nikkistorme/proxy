import { Dialog } from './Dialog';
import { FieldError } from './FieldError';
import { ImportSummaryBody, type ImportSummary } from './ImportResults';
import './ImportResults.css';
import './SheetResults.css';

/** What happened to one pile's sheet in a batch (CD-12). */
export type SheetResultItem =
  | { ok: true; pileName: string; summary: ImportSummary }
  | { ok: false; pileName: string; sourceName: string; error: string; /** The pile has cards from an earlier load, which stay (CD-11). */ keepsData: boolean };

export interface SheetResultsData {
  /** A session start or Reload all. */
  kind: 'start' | 'reload';
  items: SheetResultItem[];
}

interface SheetResultsProps {
  results: SheetResultsData | undefined;
  onClose: () => void;
}

/** Whether the results need a look when nothing asked for them: a failed sheet or a row problem. */
export function needsAttention(results: SheetResultsData): boolean {
  return results.items.some((item) => !item.ok || item.summary.problems.length > 0);
}

/** CD-12: each pile's sheet and what happened, after a session start or Reload all. */
export function SheetResults({ results, onClose }: SheetResultsProps) {
  const loaded = results?.items.filter((item) => item.ok).length ?? 0;
  const total = results?.items.length ?? 0;
  return (
    <Dialog
      open={results !== undefined}
      title="Sheet results"
      eyebrow={results && `${results.kind === 'start' ? 'Loaded' : 'Reloaded'} ${loaded} of ${total} ${total === 1 ? 'sheet' : 'sheets'}`}
      hint="Esc close"
      onClose={onClose}
      primaryLabel="Done"
    >
      {results && (
        <ul className="sheet-results__list">
          {results.items.map((item) => (
            <li key={item.pileName} className="sheet-results__item">
              <h3 className="sheet-results__pile">
                {item.pileName}
                <span className="sheet-results__source"> · {item.ok ? item.summary.fileName : item.sourceName}</span>
              </h3>
              {item.ok ? (
                <ImportSummaryBody summary={item.summary} subtitleAs="h4" />
              ) : (
                <>
                  <FieldError>{item.error}</FieldError>
                  {item.keepsData && <p className="import-results__missing">{item.pileName} keeps its last good data.</p>}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
