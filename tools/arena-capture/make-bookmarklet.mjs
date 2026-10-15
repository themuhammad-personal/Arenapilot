#!/usr/bin/env node
// Squeezes capture.js onto one line as a `javascript:` URL (a "bookmarklet"), so the
// capture can run from a phone browser's bookmarks, where there is no console.
//
//   node tools/arena-capture/make-bookmarklet.mjs        writes bookmarklet.txt
//
// capture.js is written to survive this (ASCII only, block comments only, every
// statement ends with a semicolon), so the squeeze is just: drop the comments, trim
// and join the lines, escape the two characters a URL cannot carry (% and #).
// engine-arena-capture.test.mjs fails if bookmarklet.txt is not exactly this output.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function buildBookmarklet(source) {
  const noComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
  if (noComments.includes('/*') || noComments.includes('*/')) throw new Error('unbalanced block comment');
  const code = noComments
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ');
  if (/[^\x20-\x7e]/.test(code)) throw new Error('capture.js must be ASCII only');
  return 'javascript:' + code.replace(/%/g, '%25').replace(/#/g, '%23') + ' void 0;';
}

const here = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = buildBookmarklet(fs.readFileSync(path.join(here, 'capture.js'), 'utf8'));
  fs.writeFileSync(path.join(here, 'bookmarklet.txt'), out + '\n');
  console.log(`bookmarklet.txt: ${out.length} characters`);
}
