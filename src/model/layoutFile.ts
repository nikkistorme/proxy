import type { NewItem } from '../storage/storage';
import type { BoxContent, BoxStyle, Layout, LayoutBox } from './layout';
import { copyName, validateLayoutName } from './layoutNames';

/** Marks a file as Proxy layouts, so another JSON file isn't read as one (LY-9). */
export const LAYOUT_FILE_FORMAT = 'proxy-layouts';
/** The layout file's own version. Bump it when the file changes shape. */
export const LAYOUT_FILE_VERSION = 1;
export const LAYOUT_FILE_NAME = 'proxy-layouts.json';

type FileLayout = NewItem<Layout>;

export interface LayoutFile {
  format: typeof LAYOUT_FILE_FORMAT;
  version: number;
  layouts: FileLayout[];
}

/** The layouts as a JSON file (LY-9). Ids are kept, so type mappings still find them after an import. */
export function layoutsToFile(layouts: readonly FileLayout[]): string {
  const file: LayoutFile = {
    format: LAYOUT_FILE_FORMAT,
    version: LAYOUT_FILE_VERSION,
    // Only the layout's own fields: no save time or save version.
    layouts: layouts.map(({ id, name, orientation, boxes }) => ({ id, name, orientation, boxes })),
  };
  return `${JSON.stringify(file, null, 2)}\n`;
}

export type LayoutFileResult = { layouts: FileLayout[] } | { error: string };

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === 'string';
const isPercent = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
const oneOf =
  <const T extends string | number>(...options: T[]) =>
  (value: unknown): value is T =>
    options.includes(value as T);

function readContent(value: unknown): BoxContent | undefined {
  if (!isObject(value)) return undefined;
  if (value.kind === 'color') return { kind: 'color' };
  if (value.kind === 'text') return isText(value.text) ? { kind: 'text', text: value.text } : undefined;
  if (value.kind === 'column') {
    const { columns, as } = value;
    if (!Array.isArray(columns) || !columns.every(isText) || !oneOf('text', 'image')(as)) return undefined;
    return { kind: 'column', columns, as };
  }
  return undefined;
}

function readStyle(value: unknown): BoxStyle | undefined {
  if (!isObject(value)) return undefined;
  const { size, weight, align, valign, font, color, background } = value;
  if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) return undefined;
  if (!oneOf(400, 500, 600, 700)(weight) || !oneOf('left', 'center', 'right')(align) || !oneOf('top', 'middle', 'bottom')(valign)) return undefined;
  if (!oneOf('sans', 'mono')(font) || !isText(color) || (background !== undefined && !isText(background))) return undefined;
  return { size, weight, align, valign, font, color, ...(background !== undefined && { background }) };
}

function readBox(value: unknown): LayoutBox | undefined {
  if (!isObject(value)) return undefined;
  const { id, x, y, width, height, label } = value;
  if (!isText(id) || id === '' || ![x, y, width, height].every(isPercent) || (label !== undefined && !isText(label))) return undefined;
  const content = readContent(value.content);
  const style = readStyle(value.style);
  if (!content || !style) return undefined;
  return { id, x: x as number, y: y as number, width: width as number, height: height as number, content, style, ...(label !== undefined && { label }) };
}

/**
 * Reads a layout file (LY-9). The whole file is refused if any of it is wrong,
 * so an import never brings in half a layout.
 */
export function readLayoutFile(text: string): LayoutFileResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: "This file isn't a layouts file: it isn't JSON." };
  }
  if (!isObject(data) || data.format !== LAYOUT_FILE_FORMAT || !Array.isArray(data.layouts)) {
    return { error: "This file isn't a Proxy layouts file." };
  }
  if (typeof data.version !== 'number' || data.version > LAYOUT_FILE_VERSION) {
    return { error: 'This layouts file is from a newer version of Proxy.' };
  }
  const layouts: FileLayout[] = [];
  for (const [index, value] of data.layouts.entries()) {
    const which = isObject(value) && isText(value.name) && value.name.trim() ? value.name.trim() : `number ${index + 1}`;
    if (!isObject(value) || !isText(value.id) || value.id === '' || !isText(value.name) || !oneOf('portrait', 'landscape')(value.orientation)) {
      return { error: `Layout ${which} in this file isn't valid.` };
    }
    if (!Array.isArray(value.boxes)) return { error: `Layout ${which} in this file isn't valid.` };
    const boxes: LayoutBox[] = [];
    for (const [boxIndex, boxValue] of value.boxes.entries()) {
      const box = readBox(boxValue);
      if (!box) return { error: `Box ${boxIndex + 1} of layout ${which} in this file isn't valid.` };
      boxes.push(box);
    }
    if (layouts.some((layout) => layout.id === value.id)) return { error: `Layout ${which} is in this file twice.` };
    layouts.push({ id: value.id, name: value.name.trim(), orientation: value.orientation, boxes });
  }
  return { layouts };
}

/**
 * The imported layouts, ready to save (LY-9). A layout with the same id as one
 * already here replaces it, so export, clear and import restores layouts as
 * they were. A name another layout already uses, the built-in's included, gets
 * a copy name, because names are unique (LY-1).
 */
export function mergeImportedLayouts(existing: readonly FileLayout[], imported: readonly FileLayout[]): FileLayout[] {
  const importedIds = new Set(imported.map((layout) => layout.id));
  // Layouts that stay as they are, then each import as it's named.
  const named: FileLayout[] = existing.filter((layout) => !importedIds.has(layout.id));
  const result: FileLayout[] = [];
  for (const layout of imported) {
    const name = layout.name && !validateLayoutName(named, layout.name) ? layout.name : copyName(named, layout.name || 'Layout');
    const item = { ...layout, name };
    named.push(item);
    result.push(item);
  }
  return result;
}
