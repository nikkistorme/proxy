import { bundleSummary, type Bundle } from '../model/bundle';
import { Dialog } from './Dialog';
import { FieldError } from './FieldError';
import './BundleDialogs.css';

export interface PendingImport {
  fileName: string;
  bundle: Bundle;
}

interface ImportDialogsProps {
  /** A bundle that was read and is waiting for the go-ahead (PS-4). */
  pending: PendingImport | undefined;
  /** Why an import can't go ahead, in full. Changes nothing. */
  error: string | undefined;
  onConfirm: (pending: PendingImport) => void;
  /** Both dialogs report here when they close, whichever way. */
  onClose: () => void;
}

/**
 * PS-4: the confirm step before an import, and the error dialog for a file
 * that can't be read. Both follow `Dialog`; neither has a text field, so touch
 * screens focus a button.
 */
export function ImportDialogs({ pending, error, onConfirm, onClose }: ImportDialogsProps) {
  return (
    <>
      <Dialog
        open={pending !== undefined}
        title={`Import ${pending?.fileName ?? ''}?`}
        hint="Enter import · Esc cancel"
        onClose={onClose}
        primaryLabel="Import"
        cancelLabel="Cancel"
        onSubmit={() => {
          if (pending) onConfirm(pending);
          return true;
        }}
        width="narrow"
      >
        {pending && (
          <>
            <p className="bundle-dialog__text">This file holds {bundleSummary(pending.bundle)}.</p>
            <p className="bundle-dialog__text">Saved items with the same id are replaced and the rest are added. Nothing else is removed.</p>
            <p className="bundle-dialog__text">Its session replaces this one, and undo history is cleared. The page reloads to finish.</p>
          </>
        )}
      </Dialog>
      <Dialog open={error !== undefined} title="Can't import" onClose={onClose} primaryLabel="OK" width="narrow">
        <FieldError>{error}</FieldError>
      </Dialog>
    </>
  );
}
