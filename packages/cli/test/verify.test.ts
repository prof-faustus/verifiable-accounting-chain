import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCli, tmpFile, makeVerifiableBundle } from './util.mjs';

test('F.2 verify happy path: a genuine anchored bundle verifies', () => {
  const bundle = makeVerifiableBundle(16, 5);
  const file = tmpFile('bundle.json', bundle);
  const r = runCli(['verify', '--bundle', file]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /"ok": true/);
});

test('F.2 verify refuses a trusted-operational request', () => {
  const bundle = { ...makeVerifiableBundle(16, 5), mode: 'trustedOperational' };
  const file = tmpFile('bundle_to.json', bundle);
  const r = runCli(['verify', '--bundle', file]);
  assert.notEqual(r.status, 0);
  assert.match(r.stdout, /TrustedOperationalNotAcceptedForAudit/);
});

test('F.2 verify error path: missing fields and unanchored root', () => {
  // unanchored: drop the headers so the root is not in any chain
  const bundle = makeVerifiableBundle(16, 5);
  const noHeaders = { ...bundle, headers: [] };
  const f1 = tmpFile('bundle_nh.json', noHeaders);
  const r1 = runCli(['verify', '--bundle', f1]);
  assert.notEqual(r1.status, 0);
  assert.match(r1.stdout, /RootNotAnchored/);

  const f2 = tmpFile('bundle_bad.json', { leafHex: 'zz' });
  assert.notEqual(runCli(['verify', '--bundle', f2]).status, 0);
});
