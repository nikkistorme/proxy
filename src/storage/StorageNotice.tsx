import { useStorageStatus } from './StorageProvider';
import './StorageNotice.css';

/** One line under the header when saving won't work (PS-6) or older saves were removed (PS-5). */
export function StorageNotice() {
  const { available, dropped } = useStorageStatus();
  const message = !available
    ? 'This browser can’t save right now, so progress won’t be saved.'
    : dropped
      ? 'Saves from an older version of Proxy were removed.'
      : undefined;
  if (!message) return null;
  return (
    <p className="storage-notice" role="note">
      {message}
    </p>
  );
}
