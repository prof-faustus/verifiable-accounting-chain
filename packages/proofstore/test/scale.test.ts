import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HashOps } from '@vaa/bsv';
import { heightForLeafCount } from '@vaa/merkle';
import { ProofStore, serialiseShard } from '@vaa/proofstore';
import { makeLeaves, makeKey, unwrap } from './util.mjs';

const N = 256;
const K = 4;

test('C.9 T-scale-1 shared upper portions stored once: stored bytes < naive per-item full proofs', () => {
  const leaves = makeLeaves(50, N);
  const store = new ProofStore(K);
  for (let i = 0; i < N; i++) unwrap(store.anchor(makeKey(i), leaves, i));

  const height = heightForLeafCount(N);
  const naivePerItem = serialiseShard({ fromLevel: 0, toLevel: height, siblings: leaves.slice(0, height) }).length;
  const naiveTotal = N * naivePerItem;

  assert.equal(store.itemCount(), N);
  assert.equal(store.rootCount(), 1); // one shared tree => one shared upper portion
  assert.ok(store.storedShardBytes() < naiveTotal);
});

test('C.9 T-scale-2 a tampered leaf among many is rejected', () => {
  const leaves = makeLeaves(51, N);
  const store = new ProofStore(K);
  for (let i = 0; i < N; i++) unwrap(store.anchor(makeKey(i), leaves, i));
  const stored = unwrap(store.query(makeKey(200)));
  const tampered = HashOps.toInternalBytes(leaves[200]!);
  tampered[0] = tampered[0]! ^ 0xff;
  assert.equal(store.verify(HashOps.fromInternalBytes(tampered).value, stored, 'adversarial').ok, false);
  assert.equal(store.verifyWithAssistance(HashOps.fromInternalBytes(tampered).value, stored).ok, false);
});
