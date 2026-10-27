import { useSessionStore } from '../store/sessionStore';

/** Reads every action's announcement to screen readers (AR-2). */
export function LiveRegion() {
  const announcement = useSessionStore((s) => s.announcement);
  return (
    <div role="status" aria-live="polite" className="visually-hidden">
      {/* Keyed so the same text twice in a row is still announced. */}
      <span key={announcement.id}>{announcement.text}</span>
    </div>
  );
}
