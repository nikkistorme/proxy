import { Component, Suspense, type ReactNode } from 'react';
import { useSessionStoreApi } from '../store/sessionStore';

interface BoundaryProps {
  /** What was being opened, for the message: "the pile viewer". */
  screen: string;
  /** Closes the screen, so focus goes back to where it was opened from. */
  onClose: () => void;
  /** Shows the message, announces it to screen readers. */
  onFail: (message: string) => void;
  children: ReactNode;
}

/** Catches only a failed chunk download (a rejected `lazy` import), which would otherwise blank the app. */
class ChunkErrorBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    const { screen, onClose, onFail } = this.props;
    onFail(`Couldn't open ${screen}. Check your connection, then reload the page.`);
    onClose();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * PF-3: wraps a lazy screen. While the chunk downloads it shows nothing; if the
 * download fails it shows a toast, announces it and closes the screen, so the
 * session and table stay as they were. Each opening mounts it afresh, so a
 * later opening tries again (a browser may keep the failed import failed until
 * the page is reloaded, which the message says).
 */
export function ChunkBoundary({ screen, onClose, children }: Omit<BoundaryProps, 'onFail'>) {
  const store = useSessionStoreApi();
  function fail(message: string) {
    const { showToast, announce } = store.getState();
    showToast(message);
    // The toast has no live region of its own.
    announce(message);
  }
  return (
    <ChunkErrorBoundary screen={screen} onClose={onClose} onFail={fail}>
      <Suspense fallback={null}>{children}</Suspense>
    </ChunkErrorBoundary>
  );
}
