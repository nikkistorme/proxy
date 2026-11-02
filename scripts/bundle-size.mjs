// Pure helpers for the initial JavaScript size check (8e, #172, PF-4).
import { gzipSync } from 'node:zlib';

// Scripts the browser loads at start: the module entry and every modulepreload.
export function findStartScripts(html) {
  const found = [];
  for (const tag of html.match(/<(?:script|link)\b[^>]*>/gi) ?? []) {
    const isEntry = /^<script\b/i.test(tag) && /\btype=["']module["']/i.test(tag);
    const isPreload = /^<link\b/i.test(tag) && /\brel=["']modulepreload["']/i.test(tag);
    if (!isEntry && !isPreload) continue;
    const href = tag.match(/\b(?:src|href)=["']([^"']+)["']/i)?.[1];
    if (href && !found.includes(href)) found.push(href);
  }
  return found;
}

// Maps a URL under the app's base path to a path relative to dist/.
export function resolveInDist(href, base) {
  const prefix = base.endsWith('/') ? base : `${base}/`;
  if (!href.startsWith(prefix)) throw new Error(`${href} is not under the base path ${prefix}`);
  return href.slice(prefix.length);
}

export function gzipBytes(buffer) {
  return gzipSync(buffer).length;
}

export function formatKb(bytes) {
  return `${(bytes / 1000).toFixed(2)} kB`;
}

export function sumBytes(files) {
  return files.reduce((total, file) => total + file.bytes, 0);
}
