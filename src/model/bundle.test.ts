import { describe, expect, it } from 'vitest';
import basicJson from '../../tests/fixtures/bundles/basic.json?raw';
import newerVersion from '../../tests/fixtures/bundles/newer-version.json?raw';
import notJson from '../../tests/fixtures/bundles/not-json.json?raw';
import olderVersion from '../../tests/fixtures/bundles/older-version.json?raw';
import wrongShape from '../../tests/fixtures/bundles/wrong-shape.json?raw';
import { BUNDLE_APP, bundleFileName, bundleSummary, bundleToText, readBundle, type Bundle } from './bundle';

/** The first of a list that is known to have one. */
const first = <T>(list: readonly T[]): T => {
  const [item] = list;
  if (item === undefined) throw new Error('Expected an item.');
  return item;
};
const basic = (): Bundle => {
  const read = readBundle(basicJson);
  if ('error' in read) throw new Error(read.error);
  return read.bundle;
};
/** The fixture with `change` applied to its parsed JSON. */
// The parsed fixture is edited by path, so it is loosely typed here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const changed = (change: (data: Record<string, any>) => void) => {
  const data = JSON.parse(basicJson);
  change(data);
  return readBundle(JSON.stringify(data));
};

describe('PS-4 bundle', () => {
  it('reads the valid fixture: a session, a snapshot, a card set, a layout, a format and settings', () => {
    const bundle = basic();
    expect(bundle.app).toBe(BUNDLE_APP);
    expect(bundle.session.state.formatName).toBe('Solo PvE');
    expect(bundle.snapshots).toHaveLength(1);
    expect(bundle.cardSets).toHaveLength(1);
    expect(bundle.layouts.map((layout) => layout.name)).toEqual(['Hero']);
    expect(bundle.formats.map((format) => format.name)).toEqual(['Duel night']);
    expect(bundle.settings.options).toEqual({ theme: 'dark', defaultLayout: 'l-hero' });
  });

  it('reads back what it wrote (round trip)', () => {
    const bundle = basic();
    expect(readBundle(bundleToText(bundle))).toEqual({ bundle });
  });

  it('refuses a file that is not JSON, says why, and reads nothing', () => {
    expect(readBundle(notJson)).toEqual({ error: "This file isn't a Proxy bundle: it isn't JSON." });
  });

  it('refuses JSON that is not a bundle', () => {
    expect(readBundle('[1, 2]')).toEqual({ error: "This file isn't a Proxy bundle." });
    expect(readBundle('{"app":"other","version":1}')).toEqual({ error: "This file isn't a Proxy bundle." });
  });

  it('PS-5 refuses an older bundle', () => {
    expect(readBundle(olderVersion)).toEqual({ error: "This bundle is from an older version of Proxy and can't be imported." });
  });

  it('PS-5 refuses a newer bundle', () => {
    expect(readBundle(newerVersion)).toEqual({ error: "This bundle is from a newer version of Proxy and can't be imported. Update Proxy and try again." });
  });

  it('refuses a session that is missing parts, so a restore cannot crash', () => {
    expect(readBundle(wrongShape)).toEqual({ error: "The session in this bundle isn't valid." });
  });

  it('refuses a session whose cards point at a missing definition, hand or seat', () => {
    const message = { error: "The session in this bundle isn't valid." };
    expect(changed((d) => (d.session.state.activeSeatId = 'nobody'))).toEqual(message);
    expect(changed((d) => (d.session.state.piles[0].cardIds = ['missing-card']))).toEqual(message);
    expect(changed((d) => (d.session.state.hands = { ghost: [] }))).toEqual(message);
    expect(changed((d) => (d.session.state.cards[first(Object.keys(d.session.state.cards))].definitionId = 'missing'))).toEqual(message);
  });

  it('names the first item of a kind that is not valid', () => {
    expect(changed((d) => delete d.snapshots[0].name)).toEqual({ error: 'Snapshot 1 in this bundle isn\'t valid.' });
    expect(changed((d) => (d.cardSets[0].definitions = 'no'))).toEqual({ error: 'Card set 1 in this bundle isn\'t valid.' });
    expect(changed((d) => (d.formats[0].seats[0].kind = 'robot'))).toEqual({ error: 'Format 1 in this bundle isn\'t valid.' });
    expect(changed((d) => (d.layouts[0].boxes[0].width = 500))).toEqual({ error: "Box 1 of layout Hero in this file isn't valid." });
    expect(changed((d) => (d.settings.options.theme = 'pink'))).toEqual({ error: "The settings in this bundle aren't valid." });
  });

  it('refuses two items of a kind with the same id', () => {
    expect(changed((d) => d.snapshots.push(d.snapshots[0]))).toEqual({ error: 'This bundle has two snapshots with the same id.' });
  });

  it('drops fields it does not know, such as the save time', () => {
    const result = changed((d) => {
      d.layouts[0].updatedAt = 'now';
      d.cardSets[0].extra = true;
    });
    expect('bundle' in result && 'updatedAt' in first(result.bundle.layouts)).toBe(false);
    expect('bundle' in result && 'extra' in first(result.bundle.cardSets)).toBe(false);
  });

  describe('summary', () => {
    it('counts each kind', () => {
      const bundle = basic();
      expect(bundleSummary(bundle)).toBe('1 session, 1 snapshot, 1 card set, 1 layout, 1 format and your settings');
    });

    it('uses plurals', () => {
      const bundle = basic();
      const snapshot = first(bundle.snapshots);
      const layout = first(bundle.layouts);
      bundle.snapshots = [snapshot, { ...snapshot, id: 's2' }, { ...snapshot, id: 's3' }];
      bundle.layouts = [layout, { ...layout, id: 'l2' }];
      bundle.formats = [];
      expect(bundleSummary(bundle)).toBe('1 session, 3 snapshots, 1 card set, 2 layouts, 0 formats and your settings');
    });
  });

  describe('file name', () => {
    it('is proxy, the format name as a slug, and the date', () => {
      expect(bundleFileName('Duel night!', new Date('2026-10-29T12:00:00Z'))).toBe('proxy-duel-night-2026-10-29.json');
      expect(bundleFileName('1v1 PvP', new Date('2026-01-02T00:00:00Z'))).toBe('proxy-1v1-pvp-2026-01-02.json');
      expect(bundleFileName('???', new Date('2026-01-02T00:00:00Z'))).toBe('proxy-session-2026-01-02.json');
    });
  });
});
