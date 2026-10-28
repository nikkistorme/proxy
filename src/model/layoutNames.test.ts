import { describe, expect, it } from 'vitest';
import { DEFAULT_LAYOUT, type LayoutDesign } from './layout';
import { copyName, duplicateLayout, newLayout, nextLayoutName, validateLayoutName } from './layoutNames';

const layout = (id: string, name: string): LayoutDesign & { id: string } => ({ id, name, orientation: 'portrait', boxes: [] });

describe('LY-1 layout names', () => {
  it('needs a name that no other layout, the built-in one included, has', () => {
    const layouts = [layout('a', 'Hero'), layout('b', 'Spell')];
    expect(validateLayoutName(layouts, '  ')).toBe('A layout needs a name');
    expect(validateLayoutName(layouts, ' hero ')).toBe('There is already a layout called Hero');
    expect(validateLayoutName(layouts, 'DEFAULT')).toBe('There is already a layout called Default');
    expect(validateLayoutName(layouts, 'Unit')).toBeUndefined();
  });

  it('lets a layout keep its own name, in any case', () => {
    expect(validateLayoutName([layout('a', 'Hero')], 'HERO', 'a')).toBeUndefined();
  });

  it('names new layouts Layout 1, Layout 2, … taking the first free number', () => {
    expect(nextLayoutName([])).toBe('Layout 1');
    expect(nextLayoutName([layout('a', 'Layout 1'), layout('b', 'layout 3')])).toBe('Layout 2');
  });

  it('names copies "<name> copy", then numbers them', () => {
    expect(copyName([], 'Hero')).toBe('Hero copy');
    expect(copyName([layout('a', 'Hero copy')], 'Hero')).toBe('Hero copy 2');
    expect(copyName([layout('a', 'Hero copy'), layout('b', 'Hero copy 2')], 'Hero')).toBe('Hero copy 3');
  });
});

describe('LY-1 creating and duplicating layouts', () => {
  it('a new layout is blank and portrait, with its own id', () => {
    const created = newLayout([layout('a', 'Layout 1')]);
    expect(created).toMatchObject({ name: 'Layout 2', orientation: 'portrait', boxes: [] });
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('a duplicate copies the boxes and orientation, not the id', () => {
    const copy = duplicateLayout([], DEFAULT_LAYOUT);
    expect(copy.name).toBe('Default copy');
    expect(copy.orientation).toBe(DEFAULT_LAYOUT.orientation);
    expect(copy.boxes).toEqual(DEFAULT_LAYOUT.boxes);
    expect(copy.boxes).not.toBe(DEFAULT_LAYOUT.boxes);
    const [first] = copy.boxes;
    if (first) first.x = 50;
    expect(DEFAULT_LAYOUT.boxes[0]?.x).toBe(0);
  });
});
