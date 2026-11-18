#!/usr/bin/env node
// Phase 0 baseline: what the app injects TODAY (pre-v3 `main`) per Direct modality.
//
// Loads the REAL sd-site.js in a vm (same style as android/app/src/test/js/*) and
// rebuilds the system block exactly the way injected.js does:
//   `<ArenaPilot>\n${systemPrompt}${addendum ? "\n\n" + addendum : ""}\n</ArenaPilot>`
// where systemPrompt = window.__sdSite.arenaPrompt (content.js `du` seam) and
// addendum = modalityProfile(modality).addendum. A profile with inject:false
// (image/video/audio) injects nothing.
//
// Run: node scripts/v3-baseline-prompts.mjs [outDir]
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const SITE = fs.readFileSync(path.join(repo, 'android/app/src/main/bds-assets/bds/sd-site.js'), 'utf8');
const outDir = path.resolve(process.argv[2] || path.join(repo, 'docs/v3/baseline-prompts'));

const ctx = {
  console,
  location: { host: 'arena.ai', hostname: 'arena.ai', pathname: '/text/direct', href: 'https://arena.ai/text/direct' },
  document: { querySelector: () => null, querySelectorAll: () => [], documentElement: {}, addEventListener() {} },
  navigator: { language: 'en' },
  setTimeout, clearTimeout,
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(SITE, ctx);
const site = ctx.__sdSite;

const MODES = { text: 'chat', code: 'webdev', search: 'search', image: 'image' };
const rows = [];
fs.mkdirSync(outDir, { recursive: true });
for (const [name, modality] of Object.entries(MODES)) {
  const profile = site.modalityProfile(modality);
  let text = '';
  if (profile.inject !== false) {
    const add = profile.addendum || '';
    text = `<ArenaPilot>\n${site.arenaPrompt}${add ? '\n\n' + add : ''}\n</ArenaPilot>`;
  }
  fs.writeFileSync(path.join(outDir, `${name}.txt`), text);
  rows.push({ mode: name, modality, chars: text.length, tokens: Math.ceil(text.length / 4) });
}
const base = { arenaPromptChars: site.arenaPrompt.length, arenaPromptTokens: Math.ceil(site.arenaPrompt.length / 4), modes: rows };
fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(base, null, 2) + '\n');
console.log(JSON.stringify(base, null, 2));
