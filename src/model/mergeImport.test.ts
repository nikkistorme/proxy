import { describe, expect, it } from 'vitest';
import { importCards } from '../csv/importCards';
import type { CardDefinition } from './card';
import { mergeImport } from './mergeImport';

/** Deterministic ids for tests: def-1, def-2, … */
function idSource(): () => string {
  let next = 0;
  return () => `def-${++next}`;
}

/** Imports a CSV string into an empty pile. */
function firstImport(csv: string): CardDefinition[] {
  return mergeImport([], importCards(csv).cards, idSource()).definitions;
}

/** Re-imports a CSV string over existing definitions, with new ids starting at new-1. */
function reimport(existing: CardDefinition[], csv: string) {
  let next = 0;
  return mergeImport(existing, importCards(csv).cards, () => `new-${++next}`);
}

describe('CD-5 re-import', () => {
  it('acceptance (model level): changed rules text updates the card without moving it', () => {
    const before = firstImport('name,id,rules\nImp,imp,Old text.\nOgre,,Big.\n');
    const imp = before.find((d) => d.sourceId === 'imp');
    // A table card only references its definition; its own state lives here (AR-4).
    const onTable = { definitionId: imp?.id, x: 120, y: 340, rotation: 90, counters: { damage: 2 }, face: 'back' };
    const snapshot = structuredClone(onTable);

    const { definitions, updated, added } = reimport(before, 'name,id,rules\nImp,imp,New text.\nOgre,,Big.\n');

    const after = definitions.find((d) => d.id === onTable.definitionId);
    expect(after?.front.fields.rules).toBe('New text.');
    expect(onTable).toEqual(snapshot);
    expect(updated).toEqual(['def-1', 'def-2']);
    expect(added).toEqual([]);
  });

  it('gives every card a new id on the first import', () => {
    const { definitions, added, updated, missing } = mergeImport(
      [],
      importCards('name\nImp\nOgre\n').cards,
      idSource(),
    );
    expect(definitions.map((d) => [d.id, d.front.name])).toEqual([
      ['def-1', 'Imp'],
      ['def-2', 'Ogre'],
    ]);
    expect({ added, updated, missing }).toEqual({ added: ['def-1', 'def-2'], updated: [], missing: [] });
  });

  it('matches by id even when the name changes', () => {
    const before = firstImport('name,id\nImp,imp\n');
    const { definitions } = reimport(before, 'name,id\nLesser Imp,imp\n');
    expect(definitions).toEqual([expect.objectContaining({ id: 'def-1', front: expect.objectContaining({ name: 'Lesser Imp' }) })]);
  });

  it('matches by name, ignoring case and surrounding spaces, when there is no id', () => {
    const before = firstImport('name,rules\nFire Imp,Old.\n');
    const { definitions } = reimport(before, 'name,rules\n  fire imp ,New.\n');
    expect(definitions.map((d) => [d.id, d.front.fields.rules])).toEqual([['def-1', 'New.']]);
  });

  it('still matches by name after ids are added to the sheet', () => {
    const before = firstImport('name\nImp\n');
    const { definitions, updated } = reimport(before, 'name,id\nImp,imp\n');
    expect(updated).toEqual(['def-1']);
    expect(definitions[0]?.sourceId).toBe('imp');
  });

  it('never matches two cards with different ids, even with the same name', () => {
    const before = firstImport('name,id\nImp,a\n');
    const { definitions, added, missing } = reimport(before, 'name,id\nImp,b\n');
    expect(added).toEqual(['new-1']);
    expect(missing).toEqual(['def-1']);
    expect(definitions.map((d) => [d.id, d.sourceId, d.missing])).toEqual([
      ['new-1', 'b', undefined],
      ['def-1', 'a', true],
    ]);
  });

  it('does not let a name match take a definition already matched by id', () => {
    const before = firstImport('name,id\nImp,imp\n');
    // The id-matched row comes second, but id matches are made first.
    const { definitions } = reimport(before, 'name,id\nImp,\nImp Renamed,imp\n');
    expect(definitions.map((d) => [d.id, d.front.name])).toEqual([
      ['new-1', 'Imp'],
      ['def-1', 'Imp Renamed'],
    ]);
  });

  it('pairs duplicate names in file order', () => {
    const before = firstImport('name,rules\nImp,first\nImp,second\n');
    const { definitions } = reimport(before, 'name,rules\nImp,first v2\nImp,second v2\nImp,third\n');
    expect(definitions.map((d) => [d.id, d.front.fields.rules])).toEqual([
      ['def-1', 'first v2'],
      ['def-2', 'second v2'],
      ['new-1', 'third'],
    ]);
  });

  it('keeps a card removed from the CSV, flagged missing, after the imported cards', () => {
    const before = firstImport('name\nImp\nOgre\nTroll\n');
    const { definitions, missing } = reimport(before, 'name\nTroll\nImp\n');
    expect(missing).toEqual(['def-2']);
    expect(definitions.map((d) => [d.id, d.front.name, d.missing])).toEqual([
      ['def-3', 'Troll', undefined],
      ['def-1', 'Imp', undefined],
      ['def-2', 'Ogre', true],
    ]);
  });

  it('clears the missing flag when a removed card comes back', () => {
    const before = firstImport('name\nImp\nOgre\n');
    const without = reimport(before, 'name\nImp\n').definitions;
    const { definitions, updated, missing } = reimport(without, 'name\nImp\nOgre\n');
    expect(updated).toEqual(['def-1', 'def-2']);
    expect(missing).toEqual([]);
    expect(definitions.find((d) => d.id === 'def-2')).not.toHaveProperty('missing');
  });

  it('adds and removes back faces on re-import', () => {
    const before = firstImport('name,id,back_of\nWolf,wolf,\nGate,gate,\nOpen Gate,,gate\n');
    const { definitions } = reimport(before, 'name,id,back_of\nWolf,wolf,\nNight Wolf,,wolf\nGate,gate,\n');
    expect(definitions.find((d) => d.sourceId === 'wolf')?.back?.name).toBe('Night Wolf');
    expect(definitions.find((d) => d.sourceId === 'gate')).not.toHaveProperty('back');
  });

  it('takes the new qty without changing the id', () => {
    const before = firstImport('name,qty\nImp,3\n');
    const { definitions } = reimport(before, 'name,qty\nImp,1\n');
    expect(definitions).toEqual([expect.objectContaining({ id: 'def-1', qty: 1 })]);
  });

  it('does not change the existing definitions it was given', () => {
    const before = firstImport('name,rules\nImp,Old.\nOgre,Big.\n');
    const copy = structuredClone(before);
    reimport(before, 'name,rules\nImp,New.\n');
    expect(before).toEqual(copy);
  });
});
