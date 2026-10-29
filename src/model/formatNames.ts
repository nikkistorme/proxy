import { newItemId } from '../storage/storage';
import { PRESETS, type Format, type FormatItem } from './format';
import { layoutNameKey } from './layoutChoice';

/** Every name in use, the presets' included. */
function takenNames(formats: readonly Format[]): Set<string> {
  return new Set([...PRESETS, ...formats].map((format) => layoutNameKey(format.name)));
}

/**
 * Why a format can't have this name, or undefined (FS-2). Names are unique,
 * ignoring case and outer spaces, like layout names. The presets' names count
 * as taken.
 */
export function validateFormatName(formats: readonly Format[], name: string, exceptId?: string): string | undefined {
  const key = layoutNameKey(name);
  if (key === '') return 'A format needs a name';
  const clash = [...PRESETS, ...formats.filter((format) => format.id !== exceptId)].find((format) => layoutNameKey(format.name) === key);
  if (clash) return `There is already a format called ${clash.name}`;
  return undefined;
}

/** "Solo PvE copy", then "Solo PvE copy 2", … whichever is free. */
export function copyName(formats: readonly Format[], name: string): string {
  const taken = takenNames(formats);
  const base = `${name.trim()} copy`;
  if (!taken.has(layoutNameKey(base))) return base;
  let n = 2;
  while (taken.has(layoutNameKey(`${base} ${n}`))) n++;
  return `${base} ${n}`;
}

/**
 * A copy of a format, a preset included, with its own id and a free name
 * (FS-2). Seat and pile ids stay as they are, so seat places carry over.
 */
export function duplicateFormat(formats: readonly Format[], source: Format): FormatItem {
  return {
    id: newItemId(),
    name: copyName(formats, source.name),
    seats: structuredClone(source.seats),
    piles: structuredClone(source.piles),
    usesDice: source.usesDice,
  };
}
