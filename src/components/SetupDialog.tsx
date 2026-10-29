import { useEffect, useRef, useState } from 'react';
import { useFormats } from '../formats/FormatsProvider';
import { formatById, PRESETS, type Format } from '../model/format';
import { useSetOption } from '../storage/StorageProvider';
import { useSessionStore } from '../store/sessionStore';
import { Dialog } from './Dialog';
import { FormatSummary } from './FormatSummary';
import './Form.css';
import './SetupDialog.css';

const byName = (a: Format, b: Format) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });

interface SetupDialogProps {
  open: boolean;
  /** Give each opening its own `key`, so it starts on the current format with no confirm step. `started` is true when a new session began, so focus goes to the table. */
  onClose: (started: boolean) => void;
}

/**
 * SP-1: choose a format and start a new session. A session with cards asks
 * first, in the same dialog. The choice is saved as the `defaultFormat` option.
 */
export function SetupDialog({ open, onClose }: SetupDialogProps) {
  const currentId = useSessionStore((s) => s.session.formatId);
  const hasCards = useSessionStore((s) => Object.keys(s.session.cards).length > 0);
  const startSession = useSessionStore((s) => s.startSession);
  const setOption = useSetOption();
  const { formats } = useFormats();
  const sorted = [...formats].sort(byName);
  // Starts on the session's format if it still exists, else Solo PvE.
  const [chosenId, setChosenId] = useState(() => formatById(formats, currentId).id);
  const [confirming, setConfirming] = useState(false);
  const started = useRef(false);
  const question = useRef<HTMLParagraphElement>(null);
  const format = formatById(formats, chosenId);

  useEffect(() => {
    if (confirming) question.current?.focus();
  }, [confirming]);

  function start() {
    setOption('defaultFormat', format.id);
    startSession(format);
    started.current = true;
  }

  function submit(): boolean {
    if (hasCards && !confirming) {
      setConfirming(true);
      return false;
    }
    start();
    return true;
  }

  return (
    <Dialog
      open={open}
      title={confirming ? `Start a new ${format.name} session?` : 'New session'}
      hint={confirming ? 'Enter start · Esc cancel' : 'Enter next · Esc cancel'}
      primaryLabel={confirming ? 'Start new session' : 'Start session'}
      cancelLabel={confirming ? 'Back' : 'Cancel'}
      onCancel={confirming ? () => setConfirming(false) : undefined}
      width="narrow"
      onClose={() => onClose(started.current)}
      onSubmit={submit}
    >
      {confirming ? (
        <p ref={question} tabIndex={-1} className="form-text setup-dialog__confirm">
          Start a new {format.name} session? The cards in this session will be cleared.
        </p>
      ) : (
        <fieldset className="form-choices setup-dialog__choices">
          <legend className="form-label">Format</legend>
          {[...PRESETS, ...sorted].map((choice) => (
            <label key={choice.id} className="form-choice setup-dialog__choice">
              <input
                type="radio"
                name="format"
                value={choice.id}
                checked={chosenId === choice.id}
                onChange={() => setChosenId(choice.id)}
                {...(chosenId === choice.id ? { 'data-autofocus': true } : {})}
              />
              <span className="setup-dialog__details">
                <span className="form-choice__name">{choice.name}</span>
                <FormatSummary format={choice} />
              </span>
            </label>
          ))}
        </fieldset>
      )}
    </Dialog>
  );
}
