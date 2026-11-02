import { describe, expect, it } from 'vitest';
import { findStartScripts, formatKb, gzipBytes, resolveInDist, sumBytes } from './bundle-size.mjs';

const html = `<!doctype html><html><head>
<script type="module" crossorigin src="/proxy/assets/index-abc.js"></script>
<link rel="modulepreload" crossorigin href="/proxy/assets/vendor-def.js">
<link rel="stylesheet" crossorigin href="/proxy/assets/index-abc.css">
<link rel="icon" href="/proxy/favicon.svg">
</head><body><script>var inline = 1;</script></body></html>`;

describe('PF-4 initial JavaScript size', () => {
  it('finds the entry and the modulepreloads, not styles or inline scripts', () => {
    expect(findStartScripts(html)).toEqual(['/proxy/assets/index-abc.js', '/proxy/assets/vendor-def.js']);
  });

  it('resolves hrefs under the base path to files in dist', () => {
    expect(resolveInDist('/proxy/assets/a.js', '/proxy/')).toBe('assets/a.js');
    expect(resolveInDist('/proxy/assets/a.js', '/proxy')).toBe('assets/a.js');
    expect(() => resolveInDist('/other/a.js', '/proxy/')).toThrow();
  });

  it('gzips, sums and prints kB as 1,000 bytes', () => {
    expect(gzipBytes(Buffer.from('a'.repeat(10_000)))).toBeLessThan(100);
    expect(sumBytes([{ bytes: 100 }, { bytes: 250 }])).toBe(350);
    expect(formatKb(150_000)).toBe('150.00 kB');
  });
});
