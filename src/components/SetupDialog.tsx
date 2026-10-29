import { useEffect, useRef, useState } from 'react';
import { PRESETS, presetById, type Format } from '../model/format';
import type { SeatPlace } from '../model/session';
import { useSetOption } from '../storage/StorageProvider';
import { useSessionStore } from '../store/sessionStore';
import { Dialog } from './Dialog';
import { seatIdentity } from './seatIdentity';
import './Form.css';
import './SetupDialog.css';

/** The place of each seat in a format, as `createSession` gives it. */
function seatPlaces(format: Format): SeatPlace[] {
  let players = 0;
  return format.seats.map((seat) => (seat.kind === 'environment' ? 'environment' : players++ === 0 ? 'player-1' : 'player-2'));
}

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
  const [chosenId, setChosenId] = useState(currentId);
  const [confirming, setConfirming] = useState(false);
  const started = useRef(false);
  const question = useRef<HTMLParagraphElement>(null);
  const format = presetById(chosenId);

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
          {PRESETS.map((preset) => {
            const places = seatPlaces(preset);
            return (
              <label key={preset.id} className="form-choice setup-dialog__choice">
                <input
                  type="radio"
                  name="format"
                  value={preset.id}
                  checked={chosenId === preset.id}
                  onChange={() => setChosenId(preset.id)}
                  {...(chosenId === preset.id ? { 'data-autofocus': true } : {})}
                />
                <span className="setup-dialog__details">
                  <span className="form-choice__name">{preset.name}</span>
                  <span className="setup-dialog__seats">
                    {preset.seats.map((seat, i) => {
                      const identity = seatIdentity(places[i]);
                      return (
                        <span key={seat.id} className="setup-dialog__seat" style={{ color: identity.color }}>
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                            <path d={identity.shape} />
                          </svg>
                          <span className="setup-dialog__seat-name">{seat.name}</span>
                          <span className="visually-hidden"> ({identity.shapeName})</span>
                        </span>
                      );
                    })}
                  </span>
                  <span className="form-choice__meta">Piles: {preset.piles.map((pile) => pile.name).join(', ')}</span>
                </span>
              </label>
            );
          })}
        </fieldset>
      )}
    </Dialog>
  );
}
