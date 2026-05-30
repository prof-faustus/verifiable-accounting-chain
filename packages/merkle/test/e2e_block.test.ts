import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HashOps, HeaderChain } from '@vaa/bsv';
import { computeRoot, merkleProof, verifyProof, proveAgainstChain } from '@vaa/merkle';
import { blockVector, leafHashes, blockHeader } from './blockvec.mjs';

// Genuine Bitcoin (BSV) block data (see the vector's `source` field). The same
// Merkle primitive that proves a field-leaf belongs to an accounting
// transaction's root here proves a transaction's inclusion in a block, anchoring
// the commitment on-chain.

test('B.7 computeRoot of the genuine block txids equals the published merkle root', () => {
  const leaves = leafHashes();
  const root = computeRoot(leaves);
  assert.equal(root.ok, true);
  if (root.ok) assert.equal(HashOps.toDisplayHex(root.value), blockVector.merkleRoot);
});

test('B.7 a single-leaf proof for one txid verifies', () => {
  const leaves = leafHashes();
  const proof = merkleProof(leaves, 0);
  const root = computeRoot(leaves);
  assert.equal(proof.ok && root.ok, true);
  if (proof.ok && root.ok) {
    assert.equal(verifyProof(leaves[0]!, proof.value, root.value).ok, true);
  }
});

test('B.7 proveAgainstChain succeeds when the header is in the chain, RootNotAnchored when absent', () => {
  const leaves = leafHashes();
  const proof = merkleProof(leaves, 1);
  const root = computeRoot(leaves);
  assert.equal(proof.ok && root.ok, true);
  if (!proof.ok || !root.ok) return;

  const empty = new HeaderChain();
  const absent = proveAgainstChain(leaves[1]!, proof.value, root.value, empty);
  assert.equal(absent.ok, false);
  if (!absent.ok) assert.equal(absent.reason.kind, 'RootNotAnchored');

  const chain = new HeaderChain();
  const added = chain.add(blockHeader());
  assert.equal(added.ok, true); // first header on an empty chain need only meet target
  assert.equal(proveAgainstChain(leaves[1]!, proof.value, root.value, chain).ok, true);
});
