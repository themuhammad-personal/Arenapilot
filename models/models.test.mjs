// The published model list is DATA the app serves. These tests keep it honest:
// every entry is complete, ids are unique, and the file stays small enough to be
// a release asset (a 64 KB wall is what a bridge reply and a URL fetch can carry,
// so the list is served as a file and must stay well inside it).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(here, '..', 'models.json');
const raw = fs.readFileSync(FILE, 'utf8');
const data = JSON.parse(raw);

const REQUIRED = ['id', 'name', 'provider'];
const OPTIONAL = ['contextTokens', 'note'];

test('models.json is a versioned object with a models array', () => {
  assert.equal(typeof data, 'object');
  assert.ok(Number(data.version) >= 1, 'a version is what lets the app decide to replace a cache');
  assert.ok(Array.isArray(data.models), 'models must be an array');
  assert.ok(data.updated, 'the file says when it was last touched');
});

test('every model is complete enough to pick', () => {
  const ids = new Set();
  for (const m of data.models) {
    for (const key of REQUIRED) {
      assert.ok(typeof m[key] === 'string' && m[key].trim().length > 0, `${m.id || '(no id)'}: missing ${key}`);
    }
    for (const key of Object.keys(m)) {
      assert.ok([...REQUIRED, ...OPTIONAL].includes(key), `${m.id}: unexpected key ${key}`);
    }
    assert.ok(!ids.has(m.id), `duplicate id ${m.id}`);
    ids.add(m.id);
    if (m.contextTokens !== undefined) assert.ok(Number.isFinite(m.contextTokens) && m.contextTokens >= 0);
  }
});

test('the list stays small enough to be fetched and served in one reply', () => {
  const bytes = Buffer.byteLength(raw, 'utf8');
  assert.ok(bytes < 32 * 1024, `models.json is ${bytes} bytes; keep it under 32 KB so a single bridge reply carries it`);
});

test('nothing in the list points at another app', () => {
  assert.doesNotMatch(raw, /Super ?DeepSeek|BetterDeepSeek|superdeepseek/i);
});
