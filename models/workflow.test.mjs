// The model list got its own CI job, and its own release tag. These tests pin the
// two things that make that safe:
//
//  1. `publish-models` must never become the "latest" release. The in-app updater
//     resolves updates through `GET /releases/latest` and reads `tag_name` as a
//     version; a data release titled "models" winning that lookup would look like
//     an unparsable version, i.e. a dead updater.
//  2. The APK release must keep publishing `v<version>` as latest, or every
//     installed app stops seeing updates.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '..', 'package.json'));
const yaml = require('js-yaml');

const ROOT = path.join(here, '..');
const WF = yaml.load(fs.readFileSync(path.join(ROOT, '.github/workflows/build-and-release-apk.yml'), 'utf8'));
const steps = (job) => (WF.jobs?.[job]?.steps || []).map((s) => JSON.stringify(s)).join('\n');

test('the model list is published from the repository file, by its own job', () => {
  assert.ok(WF.jobs['publish-models'], 'no publish-models job: the served list could never change');
  const job = steps('publish-models');
  assert.match(job, /models\.json/);
  assert.match(job, /"tag_name":"models"/);
  // It must be validated before it is published — a broken list is an empty picker.
  assert.match(job, /models\/models\.test\.mjs/);
});

test('a data release can never become "latest"', () => {
  const job = steps('publish-models');
  assert.match(job, /"make_latest":false/, 'the model release would win /releases/latest and break the updater');
  assert.match(job, /"prerelease":true/);
});

test('the APK release keeps the versioned latest tag the updater reads', () => {
  const job = steps('release-arena');
  // rel_cfg builds the tag as `v<version>`; here it only has to be version-derived.
  assert.match(job, /"tag_name":"\$\{\{ steps\.rel_cfg\.outputs\.tag \}\}"/);
  assert.match(job, /echo \\"tag=v\$VERSION\\"/);
  assert.match(job, /"make_latest":true/);
});

test('the APK ships the same model list it publishes', () => {
  const build = steps('build-apk');
  assert.match(build, /cp models\.json android\/app\/src\/main\/assets\/models\/models\.json/);
});
