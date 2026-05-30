import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCli } from './util.mjs';

test('F.2 T-cli-3 selftest returns success per layer on a clean build', () => {
  const r = runCli(['selftest']);
  assert.equal(r.status, 0);
  for (const layer of ['bsv', 'merkle', 'proofstore', 'evidence', 'api', 'studies']) {
    assert.match(r.stdout, new RegExp(`PASS ${layer}`));
  }
  assert.match(r.stdout, /all layers passed/);
});
