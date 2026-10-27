import { useSessionStore, type LogEntry } from '../store/sessionStore';
import { Dialog } from './Dialog';
import './SessionLog.css';

/** "just now", "3 min ago" or "2 h ago", like the Main board's log times. */
export function timeAgo(at: number, now: number): string {
  const minutes = Math.floor((now - at) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} h ago`;
}

/**
 * TT-14: the session log, newest first. For now it lists rolls and coin flips.
 * `openedAt` is when it opened, so times are worked out from then.
 */
export function SessionLog({ openedAt, onClose }: { openedAt: number | undefined; onClose: () => void }) {
  const log = useSessionStore((s) => s.log);
  const newestFirst: LogEntry[] = [...log].reverse();

  return (
    <Dialog open={openedAt !== undefined} title="Session log" width="medium" primaryLabel="Done" onClose={onClose}>
      {newestFirst.length === 0 ? (
        <p className="session-log__empty">Nothing logged yet. Rolls and coin flips show here.</p>
      ) : (
        <ol className="session-log" aria-label="Log, newest first">
          {newestFirst.map((entry, i) => (
            <li key={entry.id} className={i === 0 ? 'session-log__entry session-log__entry--latest' : 'session-log__entry'}>
              <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true" className="session-log__mark">
                <path d="M8 1.5l6.5 6.5-6.5 6.5-6.5-6.5z" />
              </svg>
              <span className="session-log__text">{entry.text}</span>
              <time className="session-log__time" dateTime={new Date(entry.at).toISOString()}>
                {timeAgo(entry.at, openedAt ?? entry.at)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </Dialog>
  );
}
