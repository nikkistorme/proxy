import './PlacementBar.css';

interface PlacementBarProps {
  name: string;
  onPlace: () => void;
  onCancel: () => void;
}

/**
 * A11Y-1: the bar shown while a card is being placed, so a tap on the table and
 * then Place does what a drag would, and every step has a visible button.
 */
export function PlacementBar({ name, onPlace, onCancel }: PlacementBarProps) {
  return (
    <div className="placement-bar" role="group" aria-label={`Placing ${name}`}>
      <span className="placement-bar__text">
        Placing <strong>{name}</strong>
        <span className="placement-bar__hint"> · Tap the table or use the arrow keys</span>
      </span>
      <button type="button" className="button button--primary" onClick={onPlace}>
        Place
      </button>
      <button type="button" className="button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
