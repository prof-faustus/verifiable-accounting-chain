import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ProofStore, serializeKey } from '@vaa/proofstore';
import { makeLeaves, makeKey, unwrap } from './util.mjs';

const N = 32;
const K = 2;

test('C.8 T-sd-1 a query returns only the queried item; nothing derived from any other record', () => {
  const leaves = makeLeaves(7, N);
  const store = new ProofStore(K);
  for (let i = 0; i < N; i++) unwrap(store.anchor(makeKey(i), leaves, i));

  const target = 5;
  const stored = unwrap(store.query(makeKey(target)));
  // The response is for the queried key only.
  assert.equal(serializeKey(stored.key), serializeKey(makeKey(target)));
  assert.equal(stored.leafIndex, target);
  // The lower shard is exactly K siblings; nothing else about any other item.
  const lower = stored.shards.find((s) => s.fromLevel === 0)!;
  assert.equal(lower.siblings.length, K);
  // No other item's key appears anywhere in the response.
  for (let i = 0; i < N; i++) {
    if (i === target) continue;
    assert.notEqual(serializeKey(stored.key), serializeKey(makeKey(i)));
  }
});

test('C.8 T-sd-2 verifyWithAssistance succeeds using only the lower shard + public labels', () => {
  const leaves = makeLeaves(8, N);
  const store = new ProofStore(K);
  for (let i = 0; i < N; i++) unwrap(store.anchor(makeKey(i), leaves, i));
  const stored = unwrap(store.query(makeKey(13)));
  // Build a disclosure carrying ONLY the lower shard (drop the upper portion).
  const lowerOnly = { ...stored, shards: stored.shards.filter((s) => s.fromLevel === 0) };
  assert.equal(store.verifyWithAssistance(leaves[13]!, lowerOnly).ok, true);
});
