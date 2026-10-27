import type { Pile } from '../model/game';
import { Menu, type MenuEntry } from './Menu';

const ICONS = {
  view: 'M4 5h7v14H4zM13 5h7v14h-7z',
  peek: 'M8 3h11v15H8zM5 6v15h11',
  load: 'M12 16V4M7 9l5-5 5 5M5 20h14',
  reload: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5',
  draw: 'M12 4v12M7 11l5 5 5-5M5 20h14',
  drawMany: 'M8 4v10M4 10l4 4 4-4M16 4v10M12 10l4 4 4-4M4 20h16',
  shuffle: 'M4 7h3l10 10h3M4 17h3l3-3M14 10l3-3h3M18 4l2 3-2 3M18 14l2 3-2 3',
  reveal: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z',
  mill: 'M4 12h12M12 7l5 5-5 5M20 5v14',
  rename: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  delete: 'M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
};

interface PileMenuProps {
  pile: Pile;
  ownerName: string | undefined;
  keepOrder: boolean;
  onView: (pileId: string) => void;
  onLoad: (pileId: string) => void;
  onToggleKeepOrder: (pileId: string) => void;
  onDraw: (pileId: string) => void;
  onDrawMany: (pileId: string) => void;
  onShuffle: (pileId: string) => void;
  onReveal: (pileId: string) => void;
  onPeek: (pileId: string) => void;
  onMill: (pileId: string) => void;
  /** False when there is no other pile to mill onto. */
  canMill: boolean;
  onRename: (pileId: string) => void;
  onDelete: (pileId: string) => void;
  /** False when the pile has cards and there is no other pile to take them. */
  canDelete: boolean;
  onClose: () => void;
}

/** Actions for one pile (SP-1, SP-2, SP-3, SP-4, SP-6, SP-7, SP-9). */
export function PileMenu(props: PileMenuProps) {
  const { pile, ownerName, keepOrder, onView, onLoad, onToggleKeepOrder, onDraw, onDrawMany, onShuffle, onReveal, onMill, canMill } = props;
  const { onPeek } = props;
  const { onRename, onDelete, canDelete, onClose } = props;
  const empty = pile.cardIds.length === 0;
  const entries: MenuEntry[] = [{ kind: 'item', id: 'load', label: 'Load CSV…', icon: ICONS.load, onSelect: () => onLoad(pile.id) }];
  if (pile.sourceName) {
    entries.push({ kind: 'item', id: 'reload', label: `Reload ${pile.sourceName}…`, icon: ICONS.reload, onSelect: () => onLoad(pile.id) });
  }
  entries.push(
    { kind: 'checkbox', id: 'keep-order', label: 'Keep CSV order', checked: keepOrder, onToggle: () => onToggleKeepOrder(pile.id) },
    { kind: 'separator', id: 'sep-1' },
    { kind: 'item', id: 'draw', label: 'Draw 1', icon: ICONS.draw, disabled: empty, onSelect: () => onDraw(pile.id) },
    { kind: 'item', id: 'draw-many', label: 'Draw cards…', icon: ICONS.drawMany, disabled: empty, onSelect: () => onDrawMany(pile.id) },
    { kind: 'item', id: 'shuffle', label: 'Shuffle', icon: ICONS.shuffle, disabled: pile.cardIds.length < 2, onSelect: () => onShuffle(pile.id) },
    { kind: 'item', id: 'reveal', label: 'Reveal top card', icon: ICONS.reveal, disabled: empty, onSelect: () => onReveal(pile.id) },
    { kind: 'item', id: 'peek', label: 'Peek at top cards…', icon: ICONS.peek, disabled: empty, onSelect: () => onPeek(pile.id) },
    { kind: 'item', id: 'mill', label: 'Mill cards…', icon: ICONS.mill, disabled: empty || !canMill, onSelect: () => onMill(pile.id) },
    { kind: 'item', id: 'view', label: 'View cards…', icon: ICONS.view, shortcut: 'V', onSelect: () => onView(pile.id) },
    { kind: 'separator', id: 'sep-2' },
    { kind: 'item', id: 'rename', label: 'Rename…', icon: ICONS.rename, onSelect: () => onRename(pile.id) },
    // An empty pile goes at once, with Undo; one with cards asks where they go, hence the ellipsis.
    { kind: 'item', id: 'delete', label: empty ? 'Delete' : 'Delete…', icon: ICONS.delete, disabled: !canDelete, onSelect: () => onDelete(pile.id) },
  );

  const count = `${pile.cardIds.length} ${pile.cardIds.length === 1 ? 'card' : 'cards'}`;
  return (
    <Menu
      label={`Actions for ${pile.name}`}
      header={[pile.name, ownerName ?? 'Shared', count].join(' · ')}
      entries={entries}
      onClose={onClose}
    />
  );
}
