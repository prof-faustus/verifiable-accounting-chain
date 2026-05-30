import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCli, tmpFile, leavesHex, txidHexAt } from './util.mjs';

test('F.2 query happy path returns only the queried item fragment', () => {
  const file = tmpFile('key.json', {
    leavesHex: leavesHex(16),
    predeterminedLevel: 2,
    leafIndex: 3,
    key: { txidHex: txidHexAt(3), direction: 'output', position: 3, blockPosition: 3 },
  });
  const r = runCli(['query', '--key', file]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /storedProof/);
  assert.match(r.stdout, /"leafIndex": 3/);
});

test('F.2 query error path: malformed file', () => {
  const file = tmpFile('key_bad.json', { leavesHex: leavesHex(16) });
  assert.notEqual(runCli(['query', '--key', file]).status, 0);
});
