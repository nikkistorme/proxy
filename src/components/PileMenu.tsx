import type { Pile } from '../model/game';
import { Menu, type MenuEntry } from './Menu';

const ICONS = {
  load: 'M12 16V4M7 9l5-5 5 5M5 20h14',
  reload: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5',
  draw: 'M12 4v12M7 11l5 5 5-5M5 20h14',
};

interface PileMenuProps {
  pile: Pile;
  ownerName: string | undefined;
  keepOrder: boolean;
  onLoad: (pileId: string) => void;
  onToggleKeepOrder: (pileId: string) => void;
  onDraw: (pileId: string) => void;
  onClose: () => void;
}

/** Actions for one pile (SP-1, SP-2, SP-3, SP-6). 2d adds the rest. */
export function PileMenu({ pile, ownerName, keepOrder, onLoad, onToggleKeepOrder, onDraw, onClose }: PileMenuProps) {
  const entries: MenuEntry[] = [{ kind: 'item', id: 'load', label: 'Load CSV…', icon: ICONS.load, onSelect: () => onLoad(pile.id) }];
  if (pile.sourceName) {
    entries.push({ kind: 'item', id: 'reload', label: `Reload ${pile.sourceName}…`, icon: ICONS.reload, onSelect: () => onLoad(pile.id) });
  }
  entries.push(
    { kind: 'checkbox', id: 'keep-order', label: 'Keep CSV order', checked: keepOrder, onToggle: () => onToggleKeepOrder(pile.id) },
    { kind: 'separator', id: 'sep-1' },
    { kind: 'item', id: 'draw', label: 'Draw 1', icon: ICONS.draw, onSelect: () => onDraw(pile.id) },
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
