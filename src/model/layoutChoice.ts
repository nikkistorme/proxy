import { faceValue, type CardFace } from './card';
import { DEFAULT_LAYOUT, type Layout, type LayoutDesign } from './layout';
import type { Options } from '../options/resolver';

/** Layout names and types match without regard to case or spaces at either end. */
export function layoutNameKey(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * The layout a face is drawn with (LY-8): the saved layout named in its
 * `layout` column, then the one its `type` maps to, then the default option,
 * then the built-in layout. A name or id that matches nothing falls through.
 * It's worked out each time a card is drawn, so edits and mapping changes
 * reach cards in play (LY-10, AR-4).
 */
export function chooseLayout(
  face: CardFace,
  layouts: readonly (LayoutDesign & Pick<Layout, 'id'>)[],
  options: Pick<Options, 'layoutByType' | 'defaultLayout'>,
): LayoutDesign {
  const byId = (id: string | null | undefined) => (id ? layouts.find((layout) => layout.id === id) : undefined);

  const named = layoutNameKey(faceValue(face, 'layout'));
  const byName = named ? layouts.find((layout) => layoutNameKey(layout.name) === named) : undefined;
  if (byName) return byName;

  const type = layoutNameKey(faceValue(face, 'type'));
  const mappedId = type
    ? Object.entries(options.layoutByType).find(([key]) => layoutNameKey(key) === type)?.[1]
    : undefined;
  return byId(mappedId) ?? byId(options.defaultLayout) ?? DEFAULT_LAYOUT;
}
