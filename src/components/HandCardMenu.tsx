import { Menu, type MenuEntry } from './Menu';

// Icons in the ActionMenu board's style.
const ICONS = {
  play: 'M12 20V8M7 13l5-5 5 5M4 4h16',
  move: 'M5 12h14M13 6l6 6-6 6',
  details: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 11v6M12 7.5v.01',
};

export type HandCommand = 'play' | 'move' | 'details';

interface HandCardMenuProps {
  name: string;
  seatName: string;
  onCommand: (command: HandCommand) => void;
  onClose: () => void;
}

/** SP-8 and TT-4: what you can do with a card in your hand. */
export function HandCardMenu({ name, seatName, onCommand, onClose }: HandCardMenuProps) {
  const entries: MenuEntry[] = [
    { kind: 'item', id: 'play', label: 'Play to table', icon: ICONS.play, shortcut: 'P', onSelect: () => onCommand('play') },
    { kind: 'item', id: 'move', label: 'Move to…', icon: ICONS.move, shortcut: 'M', onSelect: () => onCommand('move') },
    { kind: 'item', id: 'details', label: 'Details…', icon: ICONS.details, onSelect: () => onCommand('details') },
  ];
  return <Menu label={`Actions for ${name}`} header={`${name} · ${seatName}'s hand`} entries={entries} onClose={onClose} />;
}
