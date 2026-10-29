/**
 * PS-2: a compact JSON form for values that share parts by reference, like the
 * undo history, where each step is a whole session that reuses the unchanged
 * objects of its neighbours. Plain JSON would write every shared object once per
 * step; this writes each distinct object or array once.
 *
 * Every object or array gets one entry in `nodes` (children before parents).
 * A node holds its children: primitives inline, objects and arrays as `[n]`,
 * a reference to node n. Primitives never sit in an array of their own here,
 * so a one-element array in a child position can only be a reference and real
 * data can't be mistaken for one. A node is an object (an object's fields) or
 * an array (an array's items), which says which it rebuilds as.
 */
export type SharedChild = string | number | boolean | null | [number];
export type SharedNode = { [key: string]: SharedChild } | SharedChild[];
export interface SharedEncoded {
  nodes: SharedNode[];
  root: SharedChild;
}

/** Encodes a JSON-safe value. Like `JSON.stringify`, it drops `undefined` fields and writes `undefined` array items and non-finite numbers as null. */
export function encodeShared(value: unknown): SharedEncoded {
  const nodes: SharedNode[] = [];
  const ids = new Map<object, number>();
  const active = new Set<object>();

  const child = (item: unknown): SharedChild | undefined => {
    if (item === undefined || typeof item === 'function' || typeof item === 'symbol') return undefined;
    if (item === null) return null;
    if (typeof item === 'number') return Number.isFinite(item) ? item : null;
    if (typeof item === 'string' || typeof item === 'boolean') return item;
    if (typeof item !== 'object') throw new Error(`Can't encode a ${typeof item}.`);
    const known = ids.get(item);
    if (known !== undefined) return [known];
    if (active.has(item)) throw new Error("Can't encode a value that contains itself.");
    active.add(item);
    let node: SharedNode;
    if (Array.isArray(item)) {
      node = item.map((entry) => child(entry) ?? null);
    } else {
      node = {};
      for (const [key, entry] of Object.entries(item)) {
        const encoded = child(entry);
        if (encoded !== undefined) node[key] = encoded;
      }
    }
    active.delete(item);
    nodes.push(node);
    ids.set(item, nodes.length - 1);
    return [nodes.length - 1];
  };

  return { nodes, root: child(value) ?? null };
}

const isPrimitive = (value: unknown): value is string | number | boolean | null =>
  value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';

/** Rebuilds the value `encodeShared` was given. Parts that were shared come back as the same object. Throws on input that isn't in that form. */
export function decodeShared(encoded: unknown): unknown {
  if (typeof encoded !== 'object' || encoded === null) throw new Error('Shared encoding must be an object.');
  const { nodes, root } = encoded as Partial<SharedEncoded>;
  if (!Array.isArray(nodes)) throw new Error('Shared encoding has no node list.');
  const built: unknown[] = [];

  const resolve = (item: unknown): unknown => {
    if (isPrimitive(item)) return item;
    if (Array.isArray(item) && item.length === 1 && Number.isInteger(item[0]) && item[0] >= 0 && item[0] < built.length) return built[item[0]];
    throw new Error('Shared encoding has a bad reference.');
  };

  for (const node of nodes) {
    if (Array.isArray(node)) {
      built.push(node.map(resolve));
    } else if (typeof node === 'object' && node !== null) {
      const object: Record<string, unknown> = {};
      for (const [key, entry] of Object.entries(node)) object[key] = resolve(entry);
      built.push(object);
    } else {
      throw new Error('Shared encoding has a bad node.');
    }
  }
  return resolve(root);
}
