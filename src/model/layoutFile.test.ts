import { describe, expect, it } from 'vitest';
import badBox from '../../tests/fixtures/layouts/bad-box.json?raw';
import notJson from '../../tests/fixtures/layouts/not-json.json?raw';
import twoLayouts from '../../tests/fixtures/layouts/two-layouts.json?raw';
import wrongFormat from '../../tests/fixtures/layouts/wrong-format.json?raw';
import { SAVE_VERSION } from '../storage/storage';
import type { Layout } from './layout';
import { layoutsToFile, mergeImportedLayouts, readLayoutFile } from './layoutFile';

function layoutsIn(text: string) {
  const result = readLayoutFile(text);
  if ('error' in result) throw new Error(result.error);
  return result.layouts;
}

describe('LY-9 layout file', () => {
  it('reads the fixture: a portrait and a landscape layout with every kind of box', () => {
    const layouts = layoutsIn(twoLayouts);
    expect(layouts.map((layout) => [layout.id, layout.name, layout.orientation, layout.boxes.length])).toEqual([
      ['fixture-hero', 'Hero', 'portrait', 5],
      ['fixture-site', 'Site', 'landscape', 2],
    ]);
    expect(layouts[0]?.boxes.find((box) => box.id === 'cost')).toMatchObject({ label: 'Cost', style: { font: 'mono', background: '#29303b' } });
    expect(layouts[1]?.boxes[0]?.content).toEqual({ kind: 'text', text: 'SITE' });
  });

  it('writes layouts that read back exactly, without the save time or save version', () => {
    const saved: Layout[] = layoutsIn(twoLayouts).map((layout) => ({ ...layout, updatedAt: '2026-10-28T10:00:00Z', version: SAVE_VERSION }));
    const text = layoutsToFile(saved);
    expect(text).not.toContain('updatedAt');
    expect(layoutsIn(text)).toEqual(layoutsIn(twoLayouts));
    expect(JSON.parse(text)).toEqual(JSON.parse(twoLayouts));
  });

  it('refuses a file that is not JSON, not a layouts file, or from a newer version', () => {
    expect(readLayoutFile(notJson)).toEqual({ error: "This file isn't a layouts file: it isn't JSON." });
    expect(readLayoutFile(wrongFormat)).toEqual({ error: "This file isn't a Proxy layouts file." });
    expect(readLayoutFile('[]')).toEqual({ error: "This file isn't a Proxy layouts file." });
    expect(readLayoutFile(JSON.stringify({ format: 'proxy-layouts', version: 2, layouts: [] }))).toEqual({
      error: 'This layouts file is from a newer version of Proxy.',
    });
  });

  it('refuses the whole file when one box or layout is wrong, naming it', () => {
    expect(readLayoutFile(badBox)).toEqual({ error: "Box 1 of layout Broken in this file isn't valid." });
    const file = JSON.parse(twoLayouts);
    file.layouts[1].orientation = 'sideways';
    expect(readLayoutFile(JSON.stringify(file))).toEqual({ error: "Layout Site in this file isn't valid." });
    file.layouts[1] = file.layouts[0];
    expect(readLayoutFile(JSON.stringify(file))).toEqual({ error: 'Layout Hero is in this file twice.' });
    const box = JSON.parse(twoLayouts);
    box.layouts[0].boxes[2].content = { kind: 'column', columns: ['name'], as: 'video' };
    expect(readLayoutFile(JSON.stringify(box))).toEqual({ error: "Box 3 of layout Hero in this file isn't valid." });
  });
});

describe('LY-9 importing layouts', () => {
  const [hero, site] = layoutsIn(twoLayouts) as [Layout, Layout];

  it('keeps ids and names when nothing clashes', () => {
    expect(mergeImportedLayouts([], [hero, site])).toEqual([hero, site]);
  });

  it('replaces a layout with the same id, even under a new name', () => {
    const old = { ...hero, name: 'Old hero', boxes: [] };
    expect(mergeImportedLayouts([old, site], [hero])).toEqual([hero]);
  });

  it('gives a copy name to a layout whose name another layout or the built-in uses', () => {
    const mine = { ...hero, id: 'mine' };
    const builtIn = { ...site, name: ' default ' };
    expect(mergeImportedLayouts([mine], [hero, builtIn]).map((layout) => [layout.id, layout.name])).toEqual([
      ['fixture-hero', 'Hero copy'],
      ['fixture-site', 'default copy'],
    ]);
  });
});
