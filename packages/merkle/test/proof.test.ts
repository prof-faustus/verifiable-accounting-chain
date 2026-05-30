import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashLeaf, hashNode, HashOps } from '@vaa/bsv';
import { merkleProof, heightForLeafCount } from '@vaa/merkle';
import { randomLeaves } from './rng.mjs';

function unwrap<T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!r.ok) throw new Error('unexpected error ' + JSON.stringify(r.error));
  return r.value;
}

test('DB.2-T1 siblings length equals tree height for sizes 1..64', () => {
  for (let size = 1; size <= 64; size++) {
    const leaves = randomLeaves(1000 + size, size).map((x: Uint8Array) => hashLeaf(x));
    const index = size === 1 ? 0 : (size * 7) % size;
    const proof = unwrap(merkleProof(leaves, index));
    assert.equal(proof.siblings.length, heightForLeafCount(size));
  }
});

test('DB.2-T2 self-paired boundary contributes the node itself (size 3, index 2)', () => {
  const leaves = [hashLeaf(Uint8Array.of(1)), hashLeaf(Uint8Array.of(2)), hashLeaf(Uint8Array.of(3))];
  const proof = unwrap(merkleProof(leaves, 2));
  // At level 0, index 2 is the self-paired last node: its sibling is itself.
  assert.equal(HashOps.equals(proof.siblings[0]!, leaves[2]!), true);
  // At level 1, the node (c,c) pairs with (a,b).
  assert.equal(HashOps.equals(proof.siblings[1]!, hashNode(leaves[0]!, leaves[1]!)), true);
});

test('DB.2-T3 IndexOutOfRange for -1 and leaves.length', () => {
  const leaves = [hashLeaf(Uint8Array.of(1)), hashLeaf(Uint8Array.of(2))];
  assert.equal(merkleProof(leaves, -1).ok, false);
  const r = merkleProof(leaves, 2);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.kind, 'IndexOutOfRange');
});
