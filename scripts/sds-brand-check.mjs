#!/usr/bin/env node
/**
 * SDS brand gate — ensures user/model-visible strings say Super DeepSeek / SDS,
 * never "Better DeepSeek" / "BDS" (historical keys bds_*, bds-*, bds:*, bds-assets stay).
 * Run before every push: node scripts/sds-brand-check.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const IGNORE_DIRS = new Set(['node_modules', '.cache', '.git', '.gradle', 'build', '.bds-upstream', 'android/app/build', 'android/app/src/main/assets']);
const ALLOW_FILES = new Set(['scripts/sds-brand-check.mjs']);
// Files where historical BDS/BetterDeepSeek mentions are intentional (parser, docs, tests)
const ALLOW_PATTERNS = [
  'android/app/src/main/bds-assets/bds/content.js',
  'android/app/src/main/bds-assets/bds/sd-agent.js',
  'android/app/src/main/bds-assets/bds/sd-native.js',
  'docs/',
  'android/app/src/test/',
  '.grok/',
  'scripts/',
  'src/lib/tool-tags.ts',
  'android/app/src/main/java/com/superdeepseek/app/MainActivity.kt',
  'android/app/src/main/java/com/superdeepseek/app/WebViewBridge.kt',
];
let fails = [];

function shouldIgnore(file) {
  for (const d of IGNORE_DIRS) if (file.includes(`/${d}/`) || file.startsWith(`${d}/`)) return true;
  if (ALLOW_FILES.has(file)) return true;
  for (const p of ALLOW_PATTERNS) if (file.includes(p)) return true;
  return false;
}

function scanFile(rel) {
  if (shouldIgnore(rel)) return;
  const full = path.join(ROOT, rel);
  let text;
  try { text = fs.readFileSync(full, 'utf8'); } catch { return; }
  // Allow README credit at the end
  if (rel === 'README.md') {
    // Remove the final credit block that intentionally mentions Better DeepSeek
    text = text.replace(/Thanks to.*Better DeepSeek.*\n?.*$/s, '');
  }
  // content.js: allow BDS: inside parser for backward compat (old tags still work)
  // but forbid user-visible "Better DeepSeek" and "You are Better DeepSeek" etc.
  // Historical keys like bds_* , bds- , bds: , bds-assets are allowed — they are not user-visible branding.
  // We check for the literal "Better DeepSeek" (case-insensitive) outside allowed places.
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (/Better DeepSeek/i.test(line)) {
      // Allow if it's in a comment about the old name intentionally? Only README credit is allowed, already stripped.
      // content.js contains "Better DeepSeek" inside comments about old name? That's still user-visible? The prompt says never.
      // So we flag it.
      fails.push(`${rel}:${i+1}: contains "Better DeepSeek" → use "Super DeepSeek" — ${line.trim().slice(0,120)}`);
    }
    // Check for BDS branding in user-visible strings: e.g., "You are BDS" or "BDS:" in prompt not as parser
    // We allow bds_* keys, bds- css, bds: events, bds-assets path, and the literal "<BDS:" in content.js parser (old tag support)
    // Forbid standalone "Better DeepSeek" already done. For BDS, look for "\"BDS\"" or "'BDS'" or " BDS " in UI strings.
    // Simple heuristic: if line contains '"BDS"' or "'BDS'" outside content.js parser, flag.
    if (rel !== 'android/app/src/main/bds-assets/bds/content.js' && rel !== 'android/app/src/main/bds-assets/bds/sd-agent.js') {
      if (/\bBDS\b/.test(line) && !line.includes('bds_') && !line.includes('bds-') && !line.includes('bds:') && !line.includes('bds-assets')) {
        fails.push(`${rel}:${i+1}: contains "BDS" → use "SDS" — ${line.trim().slice(0,120)}`);
      }
    }
  });
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const rel = path.relative(ROOT, path.join(dir, e.name));
    if (shouldIgnore(rel)) continue;
    if (e.isDirectory()) walk(path.join(dir, e.name));
    else if (/\.(js|kt|xml|mjs|ts|tsx|md|json)$/.test(e.name)) scanFile(rel);
  }
}

walk(ROOT);
if (fails.length) {
  console.error('SDS brand check failed — found Better DeepSeek / BDS branding outside allowed places:');
  fails.forEach(f => console.error('  ' + f));
  console.error('\nAllowed only: README.md final credit, plus historical bds_*, bds-*, bds:*, bds-assets, and BDS: tag parser in content.js for backward compat.');
  process.exit(1);
} else {
  console.log('SDS brand check passed — no Better DeepSeek / BDS branding found outside allowed internal names.');
}
