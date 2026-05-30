import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HashOps } from '@vaa/bsv';
import { merkleProof } from '@vaa/merkle';
import { shardProof, reassemble } from '@vaa/proofstore';
import { makeLeaves, makeKey, unwrap } from './util.mjs';

test('DC.2-T1 two non-overlapping contiguous shards covering the whole proof', () => {
  const leaves = makeLeaves(1, 16);
  const proof = unwrap(merkleProof(leaves, 5));
  const shards = unwrap(shardProof(proof, 2));
  assert.equal(shards.length, 2);
  assert.equal(shards[0]!.fromLevel, 0);
  assert.equal(shards[0]!.toLevel, 2);
  assert.equal(shards[1]!.fromLevel, 2);
  assert.equal(shards[1]!.toLevel, proof.siblings.length);
});

test('DC.2-T2 reassemble(shardProof(p,k)) == p for sizes 2..64 and several k', () => {
  for (let n = 2; n <= 64; n++) {
    const leaves = makeLeaves(n, n);
    const proof = unwrap(merkleProof(leaves, n - 1));
    const height = proof.siblings.length;
    for (const k of [1, Math.max(1, Math.floor(height / 2)), height - 1]) {
      if (k <= 0 || k >= height) continue;
      const shards = unwrap(shardProof(proof, k));
      const reassembled = unwrap(reassemble({ key: makeKey(0), leafIndex: proof.index, shards, expectedRoot: leaves[0]! }));
      assert.equal(reassembled.siblings.length, proof.siblings.length);
      for (let i = 0; i < height; i++) {
        assert.equal(HashOps.equals(reassembled.siblings[i]!, proof.siblings[i]!), true);
      }
    }
  }
});

test('DC.2-T3 ShardBadLevel for k=0 and k=height', () => {
  const leaves = makeLeaves(3, 16);
  const proof = unwrap(merkleProof(leaves, 1));
  const height = proof.siblings.length;
  assert.equal(shardProof(proof, 0).ok, false);
  const r = shardProof(proof, height);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.kind, 'ShardBadLevel');
});

test('DC.2-T4 reassemble of a gap -> ShardNonContiguous', () => {
  const leaves = makeLeaves(4, 16);
  const proof = unwrap(merkleProof(leaves, 2));
  const shards = unwrap(shardProof(proof, 2));
  // Drop the lower shard so coverage starts at level 2 (a gap at level 0).
  const r = reassemble({ key: makeKey(0), leafIndex: proof.index, shards: [shards[1]!], expectedRoot: leaves[0]! });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.kind, 'ShardNonContiguous');
});
