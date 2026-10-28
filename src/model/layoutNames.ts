import { newItemId, type NewItem } from '../storage/storage';
import { DEFAULT_LAYOUT, type Layout, type LayoutDesign } from './layout';
import { layoutNameKey } from './layoutChoice';

/** Every name in use, the built-in layout's included. */
function takenNames(layouts: readonly LayoutDesign[]): Set<string> {
  return new Set([DEFAULT_LAYOUT, ...layouts].map((layout) => layoutNameKey(layout.name)));
}

/**
 * Why a layout can't have this name, or undefined (LY-1). Names are unique,
 * ignoring case and outer spaces, because the `layout` column picks a layout
 * by name (LY-8). The built-in layout's name counts as taken.
 */
export function validateLayoutName(layouts: readonly (LayoutDesign & Pick<Layout, 'id'>)[], name: string, exceptId?: string): string | undefined {
  const key = layoutNameKey(name);
  if (key === '') return 'A layout needs a name';
  const clash = [DEFAULT_LAYOUT, ...layouts.filter((layout) => layout.id !== exceptId)].find((layout) => layoutNameKey(layout.name) === key);
  if (clash) return `There is already a layout called ${clash.name}`;
  return undefined;
}

/** The first of "Layout 1", "Layout 2", … that's free. */
export function nextLayoutName(layouts: readonly LayoutDesign[]): string {
  const taken = takenNames(layouts);
  let n = 1;
  while (taken.has(layoutNameKey(`Layout ${n}`))) n++;
  return `Layout ${n}`;
}

/** "Hero copy", then "Hero copy 2", … whichever is free. */
export function copyName(layouts: readonly LayoutDesign[], name: string): string {
  const taken = takenNames(layouts);
  const base = `${name.trim()} copy`;
  if (!taken.has(layoutNameKey(base))) return base;
  let n = 2;
  while (taken.has(layoutNameKey(`${base} ${n}`))) n++;
  return `${base} ${n}`;
}

/** A blank portrait layout with the next free name (LY-1). */
export function newLayout(layouts: readonly LayoutDesign[]): NewItem<Layout> {
  return { id: newItemId(), name: nextLayoutName(layouts), orientation: 'portrait', boxes: [] };
}

/** A copy of a layout, the built-in one included, with its own id and a free name (LY-1). */
export function duplicateLayout(layouts: readonly LayoutDesign[], source: LayoutDesign): NewItem<Layout> {
  return {
    id: newItemId(),
    name: copyName(layouts, source.name),
    orientation: source.orientation,
    boxes: structuredClone(source.boxes),
  };
}
