// Fails when the JavaScript loaded at start is over the limit (8e, #172, PF-4).
// Run with `npm run check:size` after `npm run build`. 1 kB = 1,000 bytes, like Vite's output.
import { readFile } from 'node:fs/promises';
import { findStartScripts, formatKb, gzipBytes, resolveInDist, sumBytes } from './bundle-size.mjs';

const LIMIT_BYTES = 150_000;
const base = process.env.VITE_BASE ?? '/proxy/';

let html;
try {
  html = await readFile('dist/index.html', 'utf8');
} catch {
  console.error('dist/index.html not found. Run `npm run build` first.');
  process.exit(1);
}

const hrefs = findStartScripts(html);
if (hrefs.length === 0) {
  console.error('No start scripts found in dist/index.html.');
  process.exit(1);
}

const files = [];
for (const href of hrefs) {
  const path = resolveInDist(href, base);
  let contents;
  try {
    contents = await readFile(`dist/${path}`);
  } catch {
    console.error(`${href} is referenced by dist/index.html but dist/${path} doesn't exist.`);
    process.exit(1);
  }
  files.push({ path, bytes: gzipBytes(contents) });
}

for (const file of files) console.log(`${formatKb(file.bytes).padStart(10)}  ${file.path}`);
const total = sumBytes(files);
console.log(`${formatKb(total).padStart(10)}  total gzipped (limit ${formatKb(LIMIT_BYTES)})`);
if (total > LIMIT_BYTES) {
  console.error('Initial JavaScript is over the limit.');
  process.exit(1);
}
