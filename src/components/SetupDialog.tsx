import { useEffect, useRef, useState } from 'react';
import { useFormats } from '../formats/FormatsProvider';
import { formatById, PRESETS, type Format } from '../model/format';
import { duplicateFormat } from '../model/formatNames';
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
  /** The format to start on when it isn't the session's, like the one chosen before visiting the Formats screen. */
  initialId?: string;
  /** Edit formats…: the parent closes this dialog and opens the Formats screen, remembering the choice. */
  onEditFormats: (chosenId: string) => void;
  /** Edit a copy: a preset was duplicated, and the Formats screen opens on the copy. */
  onEditCopy: (copy: Format, message: string) => void;
}

/**
 * SP-1: choose a format and start a new session. A session with cards asks
 * first, in the same dialog. The choice is saved as the `defaultFormat` option.
 */
export function SetupDialog({ open, onClose, initialId, onEditFormats, onEditCopy }: SetupDialogProps) {
  const currentId = useSessionStore((s) => s.session.formatId);
  const hasCards = useSessionStore((s) => Object.keys(s.session.cards).length > 0);
  const startSession = useSessionStore((s) => s.startSession);
  const setOption = useSetOption();
  const { formats, saveFormat } = useFormats();
  const sorted = [...formats].sort(byName);
  // Starts on the session's format if it still exists, else Solo PvE.
  const [chosenId, setChosenId] = useState(() => formatById(formats, initialId ?? currentId).id);
  const [confirming, setConfirming] = useState(false);
  const started = useRef(false);
  const question = useRef<HTMLParagraphElement>(null);
  const format = formatById(formats, chosenId);
  const isPreset = PRESETS.some((preset) => preset.id === format.id);

  useEffect(() => {
    if (confirming) question.current?.focus();
  }, [confirming]);

  function start() {
    setOption('defaultFormat', format.id);
    startSession(format);
    started.current = true;
  }

  function editCopy() {
    const copy = duplicateFormat(formats, format);
    saveFormat(copy);
    onEditCopy(copy, `Duplicated ${format.name} as ${copy.name}.`);
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
      {!confirming && (
        <div className="setup-dialog__edit">
          <button type="button" className="button" onClick={() => onEditFormats(chosenId)}>
            Edit formats…
          </button>
          {isPreset && (
            <button type="button" className="button" aria-label={`Edit a copy of ${format.name}`} onClick={editCopy}>
              Edit a copy
            </button>
          )}
        </div>
      )}
    </Dialog>
  );
}
