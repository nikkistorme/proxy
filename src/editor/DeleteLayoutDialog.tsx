import { Dialog } from '../components/Dialog';
import type { LayoutItem } from '../layouts/LayoutsProvider';
import '../components/Form.css';

interface DeleteLayoutDialogProps {
  layout: LayoutItem | undefined;
  onConfirm: () => void;
  onClose: () => void;
}

/** LY-1: confirm deleting a layout. Its cards fall through to their next layout (LY-8). */
export function DeleteLayoutDialog({ layout, onConfirm, onClose }: DeleteLayoutDialogProps) {
  return (
    <Dialog
      open={layout !== undefined}
      title={layout ? `Delete ${layout.name}?` : ''}
      hint="Enter delete · Esc cancel"
      primaryLabel="Delete layout"
      cancelLabel="Cancel"
      width="narrow"
      onClose={onClose}
      onSubmit={() => {
        onConfirm();
        return true;
      }}
    >
      <p className="form-text">
        Cards that use it will switch to the layout their type maps to, the default layout, or the built-in layout. This can’t be undone.
      </p>
    </Dialog>
  );
}
