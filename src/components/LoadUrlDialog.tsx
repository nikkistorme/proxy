import { useEffect, useId, useRef, useState } from 'react';
import { classifySheetUrl } from '../csv/sheetUrl';
import type { Pile } from '../model/session';
import { Dialog } from './Dialog';
import { FieldControl, FieldError } from './FieldError';
import './Form.css';
import { formatFetchTime, GOOGLE_NOTE } from './fetchTime';
import './LoadUrlDialog.css';
import { PublishHowTo } from './PublishHowTo';
import { touchScreen } from './touchScreen';

export interface LoadUrlRequest {
  pile: Pile;
  /** The URL to start with: the pile's current one. */
  url?: string;
  /** When the pile's cards were last fetched, in ms. */
  fetchedAt?: number;
  /** An error to show at once, like a failed Reload (CD-11). */
  error?: string;
  /** The pile already has cards, which stay if this fails (CD-11). */
  keepsData: boolean;
}

interface LoadUrlDialogProps {
  /** Give each request its own `key`, so every opening starts with fresh values. */
  request: LoadUrlRequest | undefined;
  /** Fetches and loads. Resolves to an error message, or undefined once loaded. */
  onLoad: (pileId: string, url: string, signal: AbortSignal) => Promise<string | undefined>;
  onClose: () => void;
}

/** CD-7, CD-8, CD-9: load a pile from a published sheet or other CSV address. */
export function LoadUrlDialog({ request, onLoad, onClose }: LoadUrlDialogProps) {
  const fieldId = useId();
  const errorId = useId();
  const [url, setUrl] = useState(request?.url ?? '');
  const [error, setError] = useState(request?.error);
  const [howTo, setHowTo] = useState(false);
  const [busy, setBusy] = useState(false);
  /** On a touch screen, focus goes to a button, never straight to a text field. */
  const [touch] = useState(touchScreen);
  const abortRef = useRef<AbortController>(undefined);

  // Leaving mid-fetch (Escape, Cancel) stops it.
  useEffect(() => () => abortRef.current?.abort(), []);

  function close() {
    abortRef.current?.abort();
    onClose();
  }

  function submit(): boolean {
    if (!request || busy) return false;
    const checked = classifySheetUrl(url);
    if (checked.kind !== 'ok') {
      setError(checked.error);
      setHowTo(checked.kind === 'edit-link');
      return false;
    }
    setError(undefined);
    setHowTo(false);
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    void onLoad(request.pile.id, url, controller.signal).then((failure) => {
      if (controller.signal.aborted) return;
      setBusy(false);
      if (failure) setError(failure);
    });
    return false;
  }

  const showHowTo = howTo;
  return (
    <Dialog
      open={request !== undefined}
      title="Load from URL"
      eyebrow={request && `Into ${request.pile.name}`}
      hint="Enter load · Esc cancel"
      primaryLabel={busy ? 'Loading…' : 'Load'}
      cancelLabel="Cancel"
      width="narrow"
      onClose={close}
      onSubmit={submit}
    >
      {request && (
        <>
          <div className="form-field">
            <label htmlFor={fieldId} className="form-label">
              Published CSV address
            </label>
            <FieldControl invalid={error !== undefined}>
              <input
                id={fieldId}
                type="url"
                inputMode="url"
                autoComplete="url"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                value={url}
                readOnly={busy}
                aria-invalid={error !== undefined}
                aria-describedby={error ? errorId : undefined}
                className="form-input load-url__input"
                {...(touch ? {} : { 'data-autofocus': true })}
                onChange={(event) => setUrl(event.currentTarget.value)}
              />
            </FieldControl>
            {error && <FieldError id={errorId}>{error}</FieldError>}
          </div>

          {error && request.keepsData && !showHowTo && (
            <p className="load-url__note">{request.pile.name} keeps its last good data.</p>
          )}

          {showHowTo && <PublishHowTo />}

          {request.fetchedAt !== undefined && (
            <p className="load-url__note">
              Last fetched {formatFetchTime(request.fetchedAt)}. {GOOGLE_NOTE}
            </p>
          )}
          {busy && (
            <p className="load-url__note" role="status">
              Fetching…
            </p>
          )}
        </>
      )}
    </Dialog>
  );
}
