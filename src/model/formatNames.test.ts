import { describe, expect, it } from 'vitest';
import { COOP_PVE, PVP_1V1, SOLO_PVE, type Format } from './format';
import { copyName, duplicateFormat, validateFormatName } from './formatNames';

const mine: Format = { ...SOLO_PVE, id: 'saved-1', name: 'Mine' };
const other: Format = { ...SOLO_PVE, id: 'saved-2', name: 'Other' };

describe('FS-2 format names', () => {
  it('accepts a free name and refuses an empty one', () => {
    expect(validateFormatName([mine], 'Fresh')).toBeUndefined();
    expect(validateFormatName([mine], '   ')).toBe('A format needs a name');
  });

  it('refuses a name another format has, ignoring case and outer spaces', () => {
    expect(validateFormatName([mine, other], '  mine ')).toBe('There is already a format called Mine');
  });

  it('counts preset names as taken', () => {
    expect(validateFormatName([], 'solo pve')).toBe('There is already a format called Solo PvE');
  });

  it('lets a format keep its own name', () => {
    expect(validateFormatName([mine, other], 'MINE', 'saved-1')).toBeUndefined();
    expect(validateFormatName([mine, other], 'Other', 'saved-1')).toBe('There is already a format called Other');
  });

  it('names copies "copy", then "copy 2" and on', () => {
    expect(copyName([], 'Solo PvE')).toBe('Solo PvE copy');
    expect(copyName([{ ...mine, name: 'Solo PvE copy' }], 'Solo PvE')).toBe('Solo PvE copy 2');
    expect(copyName([{ ...mine, name: 'Solo PvE copy' }, { ...other, name: 'solo pve copy 2' }], ' Solo PvE ')).toBe('Solo PvE copy 3');
  });

  it('duplicates a preset with a new id, a free name and the same seat and pile ids', () => {
    const copy = duplicateFormat([], PVP_1V1);
    expect(copy.id).not.toBe(PVP_1V1.id);
    expect(copy.name).toBe('1v1 PvP copy');
    expect(copy.seats.map((s) => s.id)).toEqual(PVP_1V1.seats.map((s) => s.id));
    expect(copy.piles.map((p) => p.id)).toEqual(PVP_1V1.piles.map((p) => p.id));
    expect(copy.usesDice).toBe(PVP_1V1.usesDice);
  });

  it('copies deeply, so changing the copy leaves the source alone', () => {
    const copy = duplicateFormat([], COOP_PVE);
    const seat = copy.seats[0];
    const counter = seat?.counters[0];
    if (!seat || !counter) throw new Error('No seat');
    seat.name = 'Changed';
    counter.value = 99;
    expect(COOP_PVE.seats[0]?.name).toBe('Player 1');
    expect(COOP_PVE.seats[0]?.counters[0]?.value).toBe(20);
  });
});
