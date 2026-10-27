import { useState, type KeyboardEvent } from 'react';
import { changeSeatCounter } from '../actions/seatCounters';
import type { Counter, Seat } from '../model/session';
import { useSessionStore } from '../store/sessionStore';
import './SeatCounter.css';

/** On either button, ↑ or + steps up and ↓ or − steps down. */
function stepFor(event: KeyboardEvent): number {
  if (event.altKey || event.ctrlKey || event.metaKey) return 0;
  if (event.key === 'ArrowUp' || event.key === '+' || event.key === '=') return 1;
  if (event.key === 'ArrowDown' || event.key === '-' || event.key === '−') return -1;
  return 0;
}

/** TT-13: one seat counter in the seat bar, with − and + buttons, from the Main board. */
export function SeatCounter({ seat, counter }: { seat: Seat; counter: Counter }) {
  const dispatch = useSessionStore((s) => s.dispatch);
  // Highlight the value briefly when it changes, but not when the screen first shows it.
  const [shown, setShown] = useState(counter.value);
  const [changed, setChanged] = useState(false);
  if (shown !== counter.value) {
    setShown(counter.value);
    setChanged(true);
  }

  const name = `${seat.name} ${counter.name}`;
  const step = (delta: number) => dispatch((g) => changeSeatCounter(g, { seatId: seat.id, counterId: counter.id, delta }));
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const by = stepFor(event);
    if (by === 0) return;
    event.preventDefault();
    step(by);
  }

  return (
    <div className="seat-counter" role="group" aria-label={name}>
      <span className="seat-counter__label" aria-hidden="true">
        {counter.name}
      </span>
      <button type="button" className="seat-counter__step" aria-label={`Decrease ${name}`} onKeyDown={onKeyDown} onClick={() => step(-1)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M5 12h14" />
        </svg>
      </button>
      <span key={counter.value} className={changed ? 'seat-counter__value seat-counter__value--changed' : 'seat-counter__value'}>
        {counter.value}
      </span>
      <button type="button" className="seat-counter__step" aria-label={`Increase ${name}`} onKeyDown={onKeyDown} onClick={() => step(1)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  );
}
