import { Dialog } from '../components/Dialog';
import type { Format } from '../model/format';
import '../components/Form.css';

interface DeleteFormatDialogProps {
  format: Format | undefined;
  onConfirm: () => void;
  onClose: () => void;
}

/** FS-2: confirm deleting a saved format. Running sessions keep their seats and piles. */
export function DeleteFormatDialog({ format, onConfirm, onClose }: DeleteFormatDialogProps) {
  return (
    <Dialog
      open={format !== undefined}
      title={format ? `Delete ${format.name}?` : ''}
      hint="Enter delete · Esc cancel"
      primaryLabel="Delete format"
      cancelLabel="Cancel"
      width="narrow"
      onClose={onClose}
      onSubmit={() => {
        onConfirm();
        return true;
      }}
    >
      <p className="form-text">
        Sessions already started keep their seats and piles. If this is the format New session starts on, it will start on Solo PvE instead. This can’t be undone.
      </p>
    </Dialog>
  );
}
