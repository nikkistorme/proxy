import { describe, expect, it } from 'vitest';
import { seatIdentity, seatPlace } from '../components/seatIdentity';
import { COOP_PVE, formatById, PRESETS, PVP_1V1, SOLO_PVE, type Format } from './format';
import { createSession } from './session';

describe('FS-1 presets', () => {
  it('ships Solo PvE, Co-op PvE and 1v1 PvP with distinct ids', () => {
    expect(PRESETS.map((format) => format.name)).toEqual(['Solo PvE', 'Co-op PvE', '1v1 PvP']);
    expect(new Set(PRESETS.map((format) => format.id)).size).toBe(3);
  });

  it('starts a 1v1 PvP session with two seats, two empty hands and three empty piles', () => {
    const session = createSession(PVP_1V1);
    expect(session.seats.map((seat) => seat.name)).toEqual(['Player 1', 'Player 2']);
    expect(session.hands).toEqual({ 'seat-p1': [], 'seat-p2': [] });
    expect(session.piles.map((pile) => [pile.name, pile.ownerSeatId, pile.cardIds.length])).toEqual([
      ['P1 main deck', 'seat-p1', 0],
      ['P2 main deck', 'seat-p2', 0],
      ['Board cards', undefined, 0],
    ]);
    expect(session.formatName).toBe('1v1 PvP');
  });

  it('starts a Co-op PvE session with three seats, two hands and four piles', () => {
    const session = createSession(COOP_PVE);
    expect(session.seats.map((seat) => [seat.name, seat.place, seat.hasHand])).toEqual([
      ['Player 1', 'player-1', true],
      ['Player 2', 'player-2', true],
      ['Environment', 'environment', false],
    ]);
    expect(Object.keys(session.hands)).toEqual(['seat-p1', 'seat-p2']);
    expect(session.piles.map((pile) => pile.name)).toEqual(['P1 main deck', 'P2 main deck', 'Environment deck', 'Board cards']);
  });

  it('starts a Solo PvE session as before', () => {
    const session = createSession(SOLO_PVE);
    expect(session.formatId).toBe(SOLO_PVE.id);
    expect(session.activeSeatId).toBe('seat-p1');
    expect(session.seats.map((seat) => seat.id)).toEqual(['seat-p1', 'seat-env']);
    expect(session.hands).toEqual({ 'seat-p1': [] });
    expect(session.piles.map((pile) => [pile.id, pile.x, pile.y])).toEqual([
      ['pile-p1-main', 16, 16],
      ['pile-env', 158, 16],
      ['pile-board', 300, 16],
    ]);
    expect(session.usesDice).toBe(true);
  });
});

describe('FS-4 seat counters from the format', () => {
  it('gives each seat its starting counters, as its own copy', () => {
    const session = createSession(PVP_1V1);
    expect(session.seats[1]?.counters).toEqual([
      { id: 'p2-life', name: 'Life', value: 20 },
      { id: 'p2-energy', name: 'Energy', value: 0 },
    ]);
    expect(session.seats[1]?.counters[0]).not.toBe(PVP_1V1.seats[1]?.counters[0]);
  });
});

describe('Seat identity follows the seat place', () => {
  it('gives the second player seat the circle whatever its id or name', () => {
    const format: Format = {
      ...PVP_1V1,
      seats: [
        { id: 'a', name: 'North', kind: 'player', counters: [] },
        { id: 'b', name: 'South', kind: 'player', counters: [] },
      ],
      piles: [],
    };
    const { seats } = createSession(format);
    expect(seatIdentity(seatPlace(seats, 'a')).shapeName).toBe('triangle');
    expect(seatIdentity(seatPlace(seats, 'b')).shapeName).toBe('circle');
    expect(seatIdentity(seatPlace(seats, undefined)).shapeName).toBe('diamond');
  });
});

describe('FS-1 formatById', () => {
  const saved: Format = { ...PVP_1V1, id: 'saved-1', name: 'Mine' };

  it('finds a preset, then a saved format', () => {
    expect(formatById([saved], 'preset-coop-pve').name).toBe('Co-op PvE');
    expect(formatById([saved], 'saved-1').name).toBe('Mine');
  });

  it('falls back to Solo PvE for an unknown, deleted or missing id', () => {
    expect(formatById([saved], 'nope').id).toBe('preset-solo-pve');
    expect(formatById([], 'saved-1').id).toBe('preset-solo-pve');
    expect(formatById([saved], undefined).id).toBe('preset-solo-pve');
  });
});
