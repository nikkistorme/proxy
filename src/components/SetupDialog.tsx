import { useEffect, useRef, useState } from 'react';
import { useFormats } from '../formats/FormatsProvider';
import { formatById, PRESETS, type Format } from '../model/format';
import { duplicateFormat } from '../model/formatNames';
import { useSetOption } from '../storage/StorageProvider';
import { useSessionStore } from '../store/sessionStore';
import { Dialog } from './Dialog';
import { FieldError } from './FieldError';
import { FormatSummary } from './FormatSummary';
import { useLoadDemo, type DemoData } from './useLoadDemo';
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
  /** Edit a copy: a preset was duplicated, and the Formats screen opens the copy in its editor. */
  onEditCopy: (copy: Format, message: string) => void;
}

/**
 * SP-1: choose a format and start a new session. A session with cards asks
 * first, in the same dialog. The choice is saved as the `defaultFormat` option.
 * DM-5: Load demo starts a Co-op PvE session with the demo piles filled, and
 * asks the same way. It changes no options.
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
  /** Which action the confirm step is asking about. */
  const [confirming, setConfirming] = useState<'start' | 'demo' | false>(false);
  const [demo, setDemo] = useState<{ status: 'idle' | 'loading' | 'failed' }>({ status: 'idle' });
  const { fetchDemo, startDemo } = useLoadDemo();
  const started = useRef(false);
  /** Set once the dialog has closed or unmounted, so a late demo download starts nothing. */
  const gone = useRef(false);
  /** The downloaded demo, once Load demo has it; the submit that follows starts it. */
  const chunk = useRef<DemoData>(undefined);
  const demoButton = useRef<HTMLButtonElement>(null);
  const question = useRef<HTMLParagraphElement>(null);
  const format = formatById(formats, chosenId);
  const isPreset = PRESETS.some((preset) => preset.id === format.id);

  useEffect(() => {
    if (confirming) question.current?.focus();
  }, [confirming]);

  useEffect(() => {
    gone.current = false;
    return () => {
      gone.current = true;
    };
  }, []);

  function start() {
    setOption('defaultFormat', format.id);
    startSession(format);
    started.current = true;
  }

  function editCopy() {
    const copy = duplicateFormat(formats, format);
    saveFormat(copy);
    onEditCopy(copy, `Duplicated ${format.name} as ${copy.name}. Editing ${copy.name}.`);
  }

  function submit(): boolean {
    // The demo starts through the dialog's own submit, so the Dialog closes itself and focus lands on the table.
    if (chunk.current && (confirming === 'demo' || !hasCards)) {
      startDemo(chunk.current);
      started.current = true;
      return true;
    }
    if (hasCards && !confirming) {
      setConfirming('start');
      return false;
    }
    start();
    return true;
  }

  /** Downloads the demo first, so a failed download changes nothing; only then asks or starts. */
  async function loadDemo() {
    if (demo.status === 'loading') return;
    setDemo({ status: 'loading' });
    let data: DemoData;
    try {
      data = await fetchDemo();
    } catch {
      if (!gone.current) setDemo({ status: 'failed' });
      return;
    }
    if (gone.current) return;
    chunk.current = data;
    setDemo({ status: 'idle' });
    if (hasCards) setConfirming('demo');
    else demoButton.current?.form?.requestSubmit();
  }

  function back() {
    chunk.current = undefined;
    setConfirming(false);
  }

  return (
    <Dialog
      open={open}
      title={confirming === 'demo' ? 'Load the demo?' : confirming ? `Start a new ${format.name} session?` : 'New session'}
      hint={confirming === 'demo' ? 'Enter load · Esc cancel' : confirming ? 'Enter start · Esc cancel' : 'Enter next · Esc cancel'}
      primaryLabel={confirming === 'demo' ? 'Load demo' : confirming ? 'Start new session' : 'Start session'}
      cancelLabel={confirming ? 'Back' : 'Cancel'}
      onCancel={confirming ? back : undefined}
      width="narrow"
      onClose={() => {
        gone.current = true;
        onClose(started.current);
      }}
      onSubmit={submit}
    >
      {confirming ? (
        <p ref={question} tabIndex={-1} className="form-text setup-dialog__confirm">
          {confirming === 'demo' ? 'Load the demo?' : `Start a new ${format.name} session?`} The cards in this session will be cleared.
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
      {!confirming && (
        <div className="setup-dialog__demo">
          <p className="form-text">Try a sample Co-op PvE game</p>
          <button ref={demoButton} type="button" className="button" aria-describedby={demo.status === 'failed' ? 'setup-demo-error' : undefined} onClick={() => void loadDemo()}>
            {demo.status === 'loading' ? 'Loading demo…' : 'Load demo'}
          </button>
          {demo.status === 'failed' && (
            <div role="alert" className="setup-dialog__demo-error">
              <FieldError id="setup-demo-error">Couldn't load the demo. Check your connection, then reload the page.</FieldError>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
