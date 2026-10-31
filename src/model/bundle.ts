import type { Options } from '../options/resolver';
import type { AccountSettings } from '../storage/StorageProvider';
import { SAVE_VERSION, type NewItem, type StoredItem } from '../storage/storage';
import type { SessionItem } from '../store/sessionItem';
import type { SnapshotItem } from '../store/snapshotItem';
import type { CardSet } from './cardSet';
import type { Format } from './format';
import type { Layout } from './layout';
import { readLayouts } from './layoutFile';
import type { SessionState } from './session';

/** Marks a file as a Proxy bundle, so another JSON file isn't read as one (PS-4). */
export const BUNDLE_APP = 'proxy';

/** The session in a bundle. It has no undo history, because importing clears it (PS-4). */
export type BundleSession = Omit<NewItem<SessionItem>, 'history'>;
export type BundleSettings = Pick<NewItem<AccountSettings>, 'id' | 'options'>;

/** Every saved item in one file (PS-4). Items carry no save time or version: the bundle has the version, and `put` stamps the rest. */
export interface Bundle {
  app: typeof BUNDLE_APP;
  /** The save format version the items were written with (PS-5). */
  version: number;
  exportedAt: string;
  session: BundleSession;
  snapshots: NewItem<SnapshotItem>[];
  cardSets: NewItem<CardSet>[];
  layouts: NewItem<Layout>[];
  formats: NewItem<Format & StoredItem>[];
  settings: BundleSettings;
}

export type BundleResult = { bundle: Bundle } | { error: string };

type Obj = Record<string, unknown>;
const isObject = (value: unknown): value is Obj => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === 'string';
const isId = (value: unknown): value is string => isText(value) && value !== '';
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isTexts = (value: unknown): value is string[] => Array.isArray(value) && value.every(isText);
const all = <T>(value: unknown, check: (item: unknown) => item is T): value is T[] => Array.isArray(value) && value.every(check);
const hasUniqueIds = (items: readonly { id: string }[]) => new Set(items.map((item) => item.id)).size === items.length;

const isCounter = (value: unknown): boolean => isObject(value) && isId(value.id) && isText(value.name) && isNumber(value.value);

function isFace(value: unknown): boolean {
  return isObject(value) && isText(value.name) && isObject(value.fields) && Object.values(value.fields).every(isText) && [value.image, value.layout, value.type].every((v) => v === undefined || isText(v));
}

function isDefinition(value: unknown): boolean {
  return isObject(value) && isId(value.id) && isNumber(value.row) && isNumber(value.qty) && isFace(value.front) && (value.back === undefined || isFace(value.back));
}

const isRecordOf = (value: unknown, check: (item: unknown) => boolean): value is Obj => isObject(value) && Object.values(value).every(check);

function isSeat(value: unknown): boolean {
  return isObject(value) && isId(value.id) && isText(value.name) && isText(value.place) && typeof value.hasHand === 'boolean' && Array.isArray(value.counters) && value.counters.every(isCounter);
}

function isPile(value: unknown): boolean {
  return isObject(value) && isId(value.id) && isText(value.name) && isTexts(value.cardIds) && isTexts(value.definitionIds) && isNumber(value.x) && isNumber(value.y) && (value.ownerSeatId === undefined || isText(value.ownerSeatId));
}

function isCard(value: unknown): boolean {
  return isObject(value) && isId(value.id) && isText(value.definitionId) && ['front', 'back', 'down'].includes(value.side as string);
}

function isTableEntry(value: unknown): boolean {
  return isObject(value) && isText(value.cardId) && isNumber(value.x) && isNumber(value.y) && [0, 90, 180, 270].includes(value.rotation as number) && (value.counters === undefined || (Array.isArray(value.counters) && value.counters.every(isCounter)));
}

/** A card set's source, rebuilt from known fields (CD-7). */
const isWebAddress = (value: unknown): value is string => isText(value) && /^https?:\/\//i.test(value);

function readSource(value: unknown): CardSet['source'] | undefined {
  if (!isObject(value) || !isText(value.name)) return undefined;
  if (value.kind === 'file') return { kind: 'file', name: value.name };
  if (value.kind !== 'url' || !isWebAddress(value.url) || !isNumber(value.fetchedAt)) return undefined;
  return { kind: 'url', name: value.name, url: value.url, fetchedAt: value.fetchedAt };
}

/**
 * Whether a session state is complete enough to restore without crashing:
 * every part is the right shape and every id it points to exists.
 */
function isSessionState(value: unknown): value is SessionState {
  if (!isObject(value)) return false;
  const { formatId, formatName, seats, activeSeatId, definitions, cardSets, cards, piles, hands, table, usesDice } = value;
  if (!isText(formatId) || !isText(formatName) || !isText(activeSeatId) || typeof usesDice !== 'boolean') return false;
  if (!Array.isArray(seats) || !seats.every(isSeat) || !Array.isArray(piles) || !piles.every(isPile) || !Array.isArray(table) || !table.every(isTableEntry)) return false;
  if (!isRecordOf(definitions, isDefinition) || !isRecordOf(cards, isCard) || !isRecordOf(hands, isTexts)) return false;
  if (!isRecordOf(cardSets, (set) => isObject(set) && isId(set.id) && isText(set.name) && readSource(set.source) !== undefined)) return false;
  const seatIds = new Set((seats as { id: string }[]).map((seat) => seat.id));
  const cardIds = new Set(Object.keys(cards));
  const known = (ids: readonly string[]) => ids.every((id) => cardIds.has(id));
  return (
    seatIds.has(activeSeatId) &&
    Object.values(cards).every((card) => (card as { definitionId: string }).definitionId in definitions) &&
    (piles as { cardIds: string[] }[]).every((pile) => known(pile.cardIds)) &&
    Object.entries(hands).every(([seatId, ids]) => seatIds.has(seatId) && known(ids as string[])) &&
    (table as { cardId: string }[]).every((entry) => cardIds.has(entry.cardId))
  );
}

const isLogEntry = (value: unknown): boolean => isObject(value) && isNumber(value.id) && isText(value.text) && isNumber(value.at);

function readSession(value: unknown): BundleSession | undefined {
  if (!isObject(value) || !isId(value.id) || !isSessionState(value.state) || !all(value.log, isObject) || !value.log.every(isLogEntry)) return undefined;
  if (!isNumber(value.zoom) || value.zoom <= 0 || typeof value.snap !== 'boolean') return undefined;
  return { id: value.id, state: value.state, log: value.log as unknown as BundleSession['log'], zoom: value.zoom, snap: value.snap };
}

function readSnapshot(value: unknown): NewItem<SnapshotItem> | undefined {
  if (!isObject(value) || !isId(value.id) || !isText(value.name) || !isSessionState(value.state) || !Array.isArray(value.log) || !value.log.every(isLogEntry) || !isNumber(value.savedAt)) return undefined;
  return { id: value.id, name: value.name, state: value.state, log: value.log as unknown as SnapshotItem['log'], savedAt: value.savedAt };
}

function readCardSet(value: unknown): NewItem<CardSet> | undefined {
  if (!isObject(value) || !isId(value.id) || !isText(value.name) || readSource(value.source) === undefined) return undefined;
  if (!Array.isArray(value.definitions) || !value.definitions.every(isDefinition)) return undefined;
  return { id: value.id, name: value.name, source: readSource(value.source) as CardSet['source'], definitions: value.definitions as CardSet['definitions'] };
}

function readFormat(value: unknown): NewItem<Format & StoredItem> | undefined {
  if (!isObject(value) || !isId(value.id) || !isText(value.name) || typeof value.usesDice !== 'boolean') return undefined;
  const validSeat = (seat: unknown) => isObject(seat) && isId(seat.id) && isText(seat.name) && (seat.kind === 'player' || seat.kind === 'environment') && Array.isArray(seat.counters) && seat.counters.every(isCounter);
  const validPile = (pile: unknown) =>
    isObject(pile) && isId(pile.id) && isText(pile.name) && (pile.ownerSeatId === undefined || isText(pile.ownerSeatId)) && (pile.sheetUrl === undefined || isWebAddress(pile.sheetUrl));
  if (!Array.isArray(value.seats) || !value.seats.every(validSeat) || !Array.isArray(value.piles) || !value.piles.every(validPile)) return undefined;
  return { id: value.id, name: value.name, seats: value.seats as Format['seats'], piles: value.piles as Format['piles'], usesDice: value.usesDice };
}

function readSettings(value: unknown): BundleSettings | undefined {
  if (!isObject(value) || !isObject(value.options)) return undefined;
  const { theme, layoutByType, defaultLayout, defaultFormat } = value.options;
  const options: Partial<Options> = {};
  if (theme !== undefined) {
    if (theme !== 'system' && theme !== 'light' && theme !== 'dark') return undefined;
    options.theme = theme;
  }
  if (layoutByType !== undefined) {
    if (!isRecordOf(layoutByType, isText)) return undefined;
    options.layoutByType = layoutByType as Record<string, string>;
  }
  if (defaultLayout !== undefined) {
    if (defaultLayout !== null && !isText(defaultLayout)) return undefined;
    options.defaultLayout = defaultLayout;
  }
  if (defaultFormat !== undefined) {
    if (!isText(defaultFormat)) return undefined;
    options.defaultFormat = defaultFormat;
  }
  return { id: isId(value.id) ? value.id : 'account', options };
}

/** Reads a list of items with `read`, naming the first one that isn't valid. */
function readList<T extends { id: string }>(list: unknown, noun: string, read: (value: unknown) => T | undefined): { items: T[] } | { error: string } {
  if (!Array.isArray(list)) return { error: `This bundle's ${noun}s aren't valid.` };
  const items: T[] = [];
  for (const [index, value] of list.entries()) {
    const item = read(value);
    if (!item) return { error: `${noun[0]?.toUpperCase()}${noun.slice(1)} ${index + 1} in this bundle isn't valid.` };
    items.push(item);
  }
  return hasUniqueIds(items) ? { items } : { error: `This bundle has two ${noun}s with the same id.` };
}

/**
 * Reads a bundle file (PS-4). The whole file is refused if any of it is wrong
 * or from another version of Proxy (PS-5), so an import never brings in half.
 */
export function readBundle(text: string): BundleResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: "This file isn't a Proxy bundle: it isn't JSON." };
  }
  if (!isObject(data) || data.app !== BUNDLE_APP || typeof data.version !== 'number') return { error: "This file isn't a Proxy bundle." };
  if (data.version < SAVE_VERSION) return { error: "This bundle is from an older version of Proxy and can't be imported." };
  if (data.version > SAVE_VERSION) return { error: "This bundle is from a newer version of Proxy and can't be imported. Update Proxy and try again." };

  const session = readSession(data.session);
  if (!session) return { error: "The session in this bundle isn't valid." };
  const snapshots = readList(data.snapshots, 'snapshot', readSnapshot);
  if ('error' in snapshots) return snapshots;
  const cardSets = readList(data.cardSets, 'card set', readCardSet);
  if ('error' in cardSets) return cardSets;
  const formats = readList(data.formats, 'format', readFormat);
  if ('error' in formats) return formats;
  const layouts = Array.isArray(data.layouts) ? readLayouts(data.layouts) : { error: "This bundle's layouts aren't valid." };
  if ('error' in layouts) return layouts;
  const settings = readSettings(data.settings);
  if (!settings) return { error: "The settings in this bundle aren't valid." };

  return {
    bundle: {
      app: BUNDLE_APP,
      version: data.version,
      exportedAt: isText(data.exportedAt) ? data.exportedAt : '',
      session,
      snapshots: snapshots.items,
      cardSets: cardSets.items,
      layouts: layouts.layouts,
      formats: formats.items,
      settings,
    },
  };
}

/** An item without the fields `put` stamps, ready for a bundle (PS-4). */
export function bundleItem<T extends StoredItem>(item: T | NewItem<T>): NewItem<T> {
  const copy: Partial<StoredItem> = { ...item };
  delete copy.updatedAt;
  delete copy.version;
  return copy as NewItem<T>;
}

/** A bundle as pretty-printed JSON (PS-4). */
export function bundleToText(bundle: Bundle): string {
  return `${JSON.stringify(bundle, null, 2)}\n`;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** What a bundle holds, for the confirm step: "1 session, 3 snapshots, 2 card sets, 4 layouts, 1 format and your settings" (PS-4). */
export function bundleSummary(bundle: Bundle): string {
  const parts = [
    plural(1, 'session'),
    plural(bundle.snapshots.length, 'snapshot'),
    plural(bundle.cardSets.length, 'card set'),
    plural(bundle.layouts.length, 'layout'),
    plural(bundle.formats.length, 'format'),
  ];
  return `${parts.join(', ')} and your settings`;
}

/** The file name for an export: `proxy-<format name>-<YYYY-MM-DD>.json` (PS-4). */
export function bundleFileName(formatName: string, now: Date): string {
  const slug = formatName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `proxy-${slug || 'session'}-${now.toISOString().slice(0, 10)}.json`;
}
