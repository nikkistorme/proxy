import { flipKind, shownName } from '../actions/cardActions';
import type { GameState } from '../model/game';
import { Menu, type MenuEntry } from './Menu';

// Icons from the ActionMenu board, plus mirrored and extra ones in the same style.
const ICONS = {
  rotate: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5',
  rotateBack: 'M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5',
  flip: 'M12 3v18M8 7l-4 5 4 5M16 7l4 5-4 5',
  move: 'M5 12h14M13 6l6 6-6 6',
  details: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 11v6M12 7.5v.01',
  duplicate: 'M8 8h12v12H8zM4 16V4h12',
  front: 'M12 19V5M6 11l6-6 6 6',
  back: 'M12 5v14M6 13l6 6 6-6',
  delete: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
};

const FLIP_LABELS = { 'to back': 'Flip to back', 'to front': 'Flip to front', 'face down': 'Flip face down', 'face up': 'Flip face up' };

export type CardCommand = 'rotate' | 'rotate-back' | 'flip' | 'move' | 'details' | 'duplicate' | 'front' | 'back' | 'delete';

interface CardMenuProps {
  game: GameState;
  cardId: string;
  onCommand: (command: CardCommand) => void;
  onClose: () => void;
}

/** The menu's accessible name and its header line, like "Troll · Player 1 · on table". */
export function cardMenuLabel(game: GameState, cardId: string) {
  const name = shownName(game, cardId);
  const shown = name === 'a face-down card' ? 'face-down card' : name;
  const owner = game.seats.find((s) => s.id === game.cards[cardId]?.ownerSeatId)?.name ?? 'shared';
  return { label: `Actions for ${shown}`, header: `${shown.charAt(0).toUpperCase()}${shown.slice(1)} · ${owner} · on table` };
}

/** TT-5, TT-6, TT-10, TT-11 and SP-8: what you can do to a card on the table, from the ActionMenu board. */
export function CardMenu({ game, cardId, onCommand, onClose }: CardMenuProps) {
  const index = game.table.findIndex((entry) => entry.cardId === cardId);
  const item = (id: CardCommand, label: string, icon: string, shortcut?: string, disabled?: boolean): MenuEntry => ({
    kind: 'item',
    id,
    label,
    icon,
    ...(shortcut && { shortcut }),
    ...(disabled && { disabled }),
    onSelect: () => onCommand(id),
  });
  const entries: MenuEntry[] = [
    item('rotate', 'Rotate 90° clockwise', ICONS.rotate, 'R'),
    item('rotate-back', 'Rotate 90° counter-clockwise', ICONS.rotateBack, 'Shift+R'),
    item('flip', FLIP_LABELS[flipKind(game, cardId)], ICONS.flip, 'F'),
    item('move', 'Move to…', ICONS.move, 'M'),
    item('details', 'Details…', ICONS.details),
    item('duplicate', 'Duplicate', ICONS.duplicate, 'Ctrl+D'),
    item('front', 'Bring to front', ICONS.front, undefined, index === game.table.length - 1),
    item('back', 'Send to back', ICONS.back, undefined, index === 0),
    { kind: 'separator', id: 'sep' },
    item('delete', 'Delete', ICONS.delete, 'Del'),
  ];
  const { label, header } = cardMenuLabel(game, cardId);
  return <Menu label={label} header={header} entries={entries} onClose={onClose} />;
}
