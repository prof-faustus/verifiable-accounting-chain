import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCli, tmpFile } from './util.mjs';

test('F.2 anchor happy path prints a field-tree root', () => {
  const file = tmpFile('atx.json', { kind: 'invoice', fields: [{ tag: 'invoice.net', valueHex: '01000000000003e8' }] });
  const r = runCli(['anchor', '--accounting-tx', file]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /fieldTreeRootHex/);
  assert.match(r.stdout, /envelopeScriptsHex/);
});

test('F.2 anchor error path: missing file and bad args', () => {
  assert.notEqual(runCli(['anchor']).status, 0);
  assert.notEqual(runCli(['anchor', '--accounting-tx', 'does-not-exist.json']).status, 0);
});
