import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCli, tmpFile, leavesHex } from './util.mjs';

test('F.2 prove happy path prints a bundle', () => {
  const file = tmpFile('leaves.json', { leavesHex: leavesHex(8) });
  const r = runCli(['prove', '--leaves', file, '--index', '3']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /leafHex/);
  assert.match(r.stdout, /siblingsHex/);
});

test('F.2 prove error path: out-of-range index and bad args', () => {
  const file = tmpFile('leaves2.json', { leavesHex: leavesHex(4) });
  assert.notEqual(runCli(['prove', '--leaves', file, '--index', '99']).status, 0);
  assert.notEqual(runCli(['prove', '--leaves', file]).status, 0);
});
