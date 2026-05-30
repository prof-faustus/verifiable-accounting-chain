import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runCli } from './util.mjs';

const repoRoot = join(import.meta.dirname, '..', '..', '..');
const storageVector = join(repoRoot, 'vectors', 'study', 'storage_256.json');

test('F.2 T-cli-4 reproduce matches committed vectors', () => {
  const r = runCli(['reproduce']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /all vectors match/);
});

test('F.2 T-cli-4 a deliberately altered vector makes reproduce exit non-zero', () => {
  const original = readFileSync(storageVector, 'utf8');
  try {
    const tampered = JSON.parse(original);
    tampered.shardedStoredBytes = tampered.shardedStoredBytes + 1;
    writeFileSync(storageVector, JSON.stringify(tampered, null, 2) + '\n');
    const r = runCli(['reproduce']);
    assert.notEqual(r.status, 0);
    assert.match(r.stdout, /MISMATCH/);
  } finally {
    writeFileSync(storageVector, original);
  }
});
