import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { shownName } from '../actions/cardActions';
import { addCounter, counterNameProblem, removeCounter, renameCounter, setCounter } from '../actions/counters';
import type { Counter } from '../model/game';
import { useGameStore } from '../store/gameStore';
import { Dialog } from './Dialog';
import { LiveRegion } from './LiveRegion';
import './CountersDialog.css';
import './Form.css';
import { touchScreen } from './touchScreen';

export interface CountersRequest {
  cardId: string;
  /** The counter to start on, when a pill was clicked. */
  counterId?: string;
}

interface CountersDialogProps {
  /** Give each request its own `key`, so every opening starts fresh. */
  request: CountersRequest | undefined;
  onClose: () => void;
}

/** + and − step a counter from its value controls (CardStates); typing a minus there steps down too. */
function stepFor(event: KeyboardEvent): number {
  if (event.altKey || event.ctrlKey || event.metaKey) return 0;
  if (event.key === '+' || event.key === '=') return 1;
  if (event.key === '-' || event.key === '−') return -1;
  return 0;
}

/**
 * TT-8: add, change and remove a table card's counters, following the CardStates
 * "Edit counter" board on the shared `Dialog`. Every change is its own action, so
 * it's announced and undone one at a time, and Escape keeps what was set.
 */
export function CountersDialog({ request, onClose }: CountersDialogProps) {
  const game = useGameStore((s) => s.game);
  const dispatch = useGameStore((s) => s.dispatch);
  const newNameId = useId();
  const errorId = useId();
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string>();
  const newNameRef = useRef<HTMLInputElement>(null);
  /** A counter whose value field should take focus once it has rendered. */
  const [focusCounter, setFocusCounter] = useState<string>();
  /** On a touch screen, focus goes to buttons, never straight to a text field. */
  const [touch] = useState(touchScreen);
  const addRef = useRef<HTMLButtonElement>(null);

  const entry = request && game.table.find((e) => e.cardId === request.cardId);
  const counters = entry?.counters ?? [];
  const cardId = request?.cardId ?? '';
  // The pill that was clicked, else the first counter, else the new counter's name
  // (or, on a touch screen, the dialog's first button).
  const startOn = request && (counters.find((c) => c.id === request.counterId) ?? counters[0])?.id;

  function add() {
    const problem = counterNameProblem(game, cardId, newName);
    if (problem) {
      setError(problem);
      newNameRef.current?.focus();
      return;
    }
    const result = dispatch((g, context) => addCounter(g, { cardId, name: newName }, context));
    setNewName('');
    setError(undefined);
    setFocusCounter(result.counterId);
  }

  function remove(counterId: string) {
    dispatch((g) => removeCounter(g, { cardId, counterId }));
    (touch ? addRef : newNameRef).current?.focus();
  }

  const name = entry ? shownName(game, cardId) : '';
  return (
    <Dialog open={entry !== undefined} title={`Counters on ${name === 'a face-down card' ? 'face-down card' : name}`} hint="+/− step · Esc close" primaryLabel="Done" width="narrow" onClose={onClose}>
      {entry && (
        <>
          {counters.length > 0 && (
            <ul className="counters-list">
              {counters.map((counter) => (
                <CounterRow
                  key={counter.id}
                  counter={counter}
                  startHere={counter.id === startOn}
                  touch={touch}
                  focusNow={counter.id === focusCounter}
                  onFocused={() => setFocusCounter(undefined)}
                  onSet={(value) => dispatch((g) => setCounter(g, { cardId, counterId: counter.id, value }))}
                  onRename={(next) =>
                    dispatch((g) =>
                      renameCounter(g, {
                        cardId,
                        counterId: counter.id,
                        name: next,
                      }),
                    )
                  }
                  nameProblem={(next) => counterNameProblem(game, cardId, next, counter.id)}
                  onRemove={() => remove(counter.id)}
                />
              ))}
            </ul>
          )}
          <div className="form-field counters-add">
            <label htmlFor={newNameId} className="form-label">
              New counter name
            </label>
            <div className="counters-add__row">
              <input
                ref={newNameRef}
                id={newNameId}
                className="form-input"
                value={newName}
                placeholder="Damage, +1/+1…"
                aria-invalid={error !== undefined}
                aria-describedby={error ? errorId : undefined}
                {...(startOn === undefined && !touch && { 'data-autofocus': true })}
                onChange={(event) => {
                  setNewName(event.currentTarget.value);
                  setError(undefined);
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  add();
                }}
              />
              <button ref={addRef} type="button" className="button" onClick={add}>
                Add counter
              </button>
            </div>
            {error && (
              <p id={errorId} className="form-error">
                {error}
              </p>
            )}
          </div>
          <LiveRegion />
        </>
      )}
    </Dialog>
  );
}

interface CounterRowProps {
  counter: Counter;
  /** Takes focus when the dialog opens. */
  startHere: boolean;
  /** Focus the + button rather than the value field, so no keyboard slides up. */
  touch: boolean;
  /** Takes focus now, as a counter that was just added. */
  focusNow: boolean;
  onFocused: () => void;
  onSet: (value: number) => void;
  onRename: (name: string) => void;
  nameProblem: (name: string) => string | undefined;
  onRemove: () => void;
}

/** One counter: its name, − value +, and Remove. Typed text is kept on Enter, Escape or leaving the field. */
function CounterRow({ counter, startHere, touch, focusNow, onFocused, onSet, onRename, nameProblem, onRemove }: CounterRowProps) {
  const nameId = useId();
  const valueId = useId();
  const errorId = useId();
  // Typed text not yet kept; undefined shows the store's value, which undo and the buttons change.
  const [nameTyped, setNameDraft] = useState<string>();
  const [valueTyped, setValueDraft] = useState<string>();
  const nameDraft = nameTyped ?? counter.name;
  const valueDraft = valueTyped ?? String(counter.value);
  const [nameError, setNameError] = useState<string>();
  const valueRef = useRef<HTMLInputElement>(null);
  const increaseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!focusNow) return;
    (touch ? increaseRef : valueRef).current?.focus();
    onFocused();
  }, [focusNow, touch, onFocused]);

  function commitName() {
    if (nameDraft.trim() === counter.name) {
      setNameDraft(undefined);
      return;
    }
    const problem = nameProblem(nameDraft);
    setNameError(problem);
    if (problem) return;
    onRename(nameDraft);
    setNameDraft(undefined);
  }

  function commitValue() {
    const value = Number(valueDraft);
    if (/^\s*-?\d+\s*$/.test(valueDraft) && Number.isSafeInteger(value) && value !== counter.value) onSet(value);
    setValueDraft(undefined);
  }

  function step(by: number) {
    setValueDraft(undefined);
    onSet(counter.value + by);
  }

  function onStepKey(event: KeyboardEvent<HTMLElement>) {
    const by = stepFor(event);
    if (by === 0) return;
    event.preventDefault();
    step(by);
  }

  return (
    <li>
      {/* Every row has the same labels, so the group's name says which counter it is. */}
      <div className="counters-row" role="group" aria-label={`${counter.name} counter`}>
        <div className="form-field">
          <label htmlFor={nameId} className="form-label">
            Counter name
          </label>
          <input
            id={nameId}
            className="form-input"
            value={nameDraft}
            aria-invalid={nameError !== undefined}
            aria-describedby={nameError ? errorId : undefined}
            onChange={(event) => {
              setNameDraft(event.currentTarget.value);
              setNameError(undefined);
            }}
            onBlur={commitName}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitName();
              } else if (event.key === 'Escape') {
                commitName();
              }
            }}
          />
          {nameError && (
            <p id={errorId} className="form-error">
              {nameError}
            </p>
          )}
        </div>
        <div className="counters-row__value" role="group" aria-label={`${counter.name} value`}>
          <button type="button" className="button counters-row__step" aria-label={`Decrease ${counter.name}`} onKeyDown={onStepKey} onClick={() => step(-1)}>
            −
          </button>
          <label htmlFor={valueId} className="visually-hidden">
            {counter.name}
          </label>
          <input
            ref={valueRef}
            id={valueId}
            className="form-input form-input--number counters-row__number"
            type="text"
            inputMode="numeric"
            value={valueDraft}
            {...(startHere && !touch && { 'data-autofocus': true })}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => setValueDraft(event.currentTarget.value)}
            onBlur={commitValue}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitValue();
              } else if (event.key === 'Escape') {
                commitValue();
              } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                event.preventDefault();
                step(event.key === 'ArrowUp' ? 1 : -1);
              } else {
                onStepKey(event);
              }
            }}
          />
          <button
            ref={increaseRef}
            type="button"
            className="button counters-row__step"
            aria-label={`Increase ${counter.name}`}
            {...(startHere && touch && { 'data-autofocus': true })}
            onKeyDown={onStepKey}
            onClick={() => step(1)}
          >
            +
          </button>
        </div>
        <button type="button" className="counters-row__remove" onKeyDown={onStepKey} onClick={onRemove}>
          Remove counter
        </button>
      </div>
    </li>
  );
}
