import { DICE } from '../actions/dice';
import { useSessionStore } from '../store/sessionStore';
import { Dialog } from './Dialog';
import './DiceDialog.css';

/**
 * TT-14: roll a die or flip a coin, from the Main board's dice panel. Focus
 * stays on the button rolled, so Enter rolls it again. The live region reads
 * each result, so the result box here is visual only.
 */
export function DiceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const rollDie = useSessionStore((s) => s.roll);
  const lastRoll = useSessionStore((s) => s.lastRoll);

  return (
    <Dialog open={open} title="Dice & coins" width="narrow" primaryLabel="Done" onClose={onClose}>
      <div className="dice__grid" role="group" aria-label="Roll">
        {DICE.map((die) => (
          <button
            key={die}
            type="button"
            className="dice__button"
            aria-label={die === 'Coin' ? 'Flip a coin' : `Roll ${die}`}
            {...(die === 'd20' && { 'data-autofocus': true })}
            onClick={() => rollDie(die)}
          >
            {die}
          </button>
        ))}
      </div>
      <div className="dice__result" aria-hidden="true">
        {lastRoll ? (
          <>
            <span key={lastRoll.id} className="dice__value">
              {lastRoll.result}
            </span>
            <span className="dice__die">{lastRoll.die === 'Coin' ? 'Coin flip' : lastRoll.die}</span>
          </>
        ) : (
          <span className="dice__empty">Pick a die to roll.</span>
        )}
      </div>
    </Dialog>
  );
}
