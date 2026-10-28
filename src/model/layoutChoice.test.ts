import { describe, expect, it } from 'vitest';
import type { CardFace } from './card';
import { DEFAULT_LAYOUT, type Layout } from './layout';
import { chooseLayout } from './layoutChoice';

function layout(id: string, name: string): Layout {
  return { id, name, orientation: 'portrait', boxes: [], updatedAt: '', version: 1 };
}

const hero = layout('l-hero', 'Hero');
const spell = layout('l-spell', 'Spell');
const plain = layout('l-plain', 'Plain');
const layouts = [hero, spell, plain];
const none = { layoutByType: {}, defaultLayout: null };

function face(columns: Partial<CardFace> = {}): CardFace {
  return { name: 'Troll', fields: {}, ...columns };
}

describe('LY-8 choosing a card’s layout', () => {
  it('uses the layout named in the `layout` column, ignoring case and spaces', () => {
    expect(chooseLayout(face({ layout: ' hero ', type: 'Spell' }), layouts, { layoutByType: { spell: 'l-spell' }, defaultLayout: 'l-plain' })).toBe(hero);
  });

  it('then the layout the card’s type maps to', () => {
    expect(chooseLayout(face({ type: 'Spell' }), layouts, { layoutByType: { spell: 'l-spell' }, defaultLayout: 'l-plain' })).toBe(spell);
    expect(chooseLayout(face({ type: ' SPELL ' }), layouts, { layoutByType: { Spell: 'l-spell' }, defaultLayout: null })).toBe(spell);
  });

  it('then the default layout option', () => {
    expect(chooseLayout(face({ type: 'Creature' }), layouts, { layoutByType: { spell: 'l-spell' }, defaultLayout: 'l-plain' })).toBe(plain);
  });

  it('then the built-in layout', () => {
    expect(chooseLayout(face(), layouts, none)).toBe(DEFAULT_LAYOUT);
    expect(chooseLayout(face(), [], none)).toBe(DEFAULT_LAYOUT);
  });

  it('falls through a name or id that matches nothing', () => {
    expect(chooseLayout(face({ layout: 'Gone', type: 'Spell' }), layouts, { layoutByType: { spell: 'l-spell' }, defaultLayout: null })).toBe(spell);
    expect(chooseLayout(face({ type: 'Spell' }), layouts, { layoutByType: { spell: 'l-deleted' }, defaultLayout: 'l-plain' })).toBe(plain);
    expect(chooseLayout(face(), layouts, { layoutByType: {}, defaultLayout: 'l-deleted' })).toBe(DEFAULT_LAYOUT);
  });
});
