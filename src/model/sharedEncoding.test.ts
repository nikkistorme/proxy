import { describe, expect, it } from 'vitest';
import { decodeShared, encodeShared } from './sharedEncoding';

describe('PS-2 shared encoding', () => {
  it('round-trips nested data', () => {
    const value = { a: 1, b: 'two', c: [true, null, { d: [] }], e: {}, f: [[1, 2], [3]], $ref: [0], nodes: 'real data' };
    expect(decodeShared(encodeShared(value))).toEqual(value);
    expect(decodeShared(JSON.parse(JSON.stringify(encodeShared(value))))).toEqual(value);
  });

  it('handles primitives as the root', () => {
    expect(decodeShared(encodeShared(5))).toBe(5);
    expect(decodeShared(encodeShared(null))).toBeNull();
  });

  it('treats undefined and non-finite numbers like JSON.stringify', () => {
    const value = { a: undefined, b: [undefined, NaN, 1], c: Infinity };
    expect(decodeShared(encodeShared(value))).toEqual(JSON.parse(JSON.stringify(value)));
  });

  it('writes a shared object once and gives it back shared', () => {
    const shared = { big: [1, 2, 3], name: 'x' };
    const decoded = decodeShared(encodeShared({ steps: [{ s: shared }, { s: shared }, { s: shared, extra: 1 }] })) as { steps: { s: unknown }[] };
    expect(decoded.steps[0]?.s).toBe(decoded.steps[1]?.s);
    expect(decoded.steps[0]?.s).toBe(decoded.steps[2]?.s);
    expect(JSON.stringify(encodeShared({ steps: [{ s: shared }, { s: shared }] })).match(/"name"/g)).toHaveLength(1);
  });

  it('stays the same size over repeated decode and encode', () => {
    const shared = { big: [1, 2, 3] };
    const first = encodeShared([{ s: shared }, { s: shared, n: 1 }]);
    const second = encodeShared(decodeShared(first));
    expect(second).toEqual(first);
    expect(encodeShared(decodeShared(second))).toEqual(first);
  });

  it('throws on a value that contains itself', () => {
    const loop: Record<string, unknown> = {};
    loop.self = loop;
    expect(() => encodeShared(loop)).toThrow(/contains itself/);
  });

  it.each([
    ['not an object', 'text'],
    ['no node list', { root: null }],
    ['a reference to a later node', { nodes: [[[1]], []], root: [0] }],
    ['a reference out of range', { nodes: [], root: [3] }],
    ['a bad reference form', { nodes: [], root: { x: 1 } }],
    ['a node that is a number', { nodes: [4], root: [0] }],
  ])('throws on malformed input: %s', (_name, input) => {
    expect(() => decodeShared(input)).toThrow();
  });
});
