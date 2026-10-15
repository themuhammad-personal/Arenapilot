import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scenarioResult, totals } from '../../../../../tools/harness/report.mjs';

test('harness skip is not a pass, and cannot hide an assertion failure', () => {
  const pass = scenarioResult('passed', { failures: [] });
  const skip = scenarioResult('unverified', { skipped: true, failures: [] });
  const fail = scenarioResult('broken', { skipped: true, failures: ['assertion'] });
  assert.equal(skip.pass, false);
  assert.equal(fail.skipped, false);
  assert.deepEqual(totals([pass, skip, fail]), { passed: 1, skipped: 1, failed: 1 });
  assert.deepEqual(totals(Array(7).fill(pass).concat([skip, skip])), { passed: 7, skipped: 2, failed: 0 });
});
