import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashLeaf, HashOps, HeaderChain } from '@vaa/bsv';
import {
  merkleProof,
  computeRoot,
  verifyProof,
  reconstructRoot,
  proveAgainstChain,
  heightForLeafCount,
} from '@vaa/merkle';
import { randomLeaves } from './rng.mjs';

function unwrap<T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!r.ok) throw new Error('unexpected error ' + JSON.stringify(r.error));
  return r.value;
}

test('DB.3-T1 merkleProof then verifyProof ok for sizes 1..1024', () => {
  for (const size of [1, 2, 3, 5, 8, 17, 64, 255, 256, 1023, 1024]) {
    const leaves = randomLeaves(size, size).map((x: Uint8Array) => hashLeaf(x));
    const index = size === 1 ? 0 : (size * 13) % size;
    const proof = unwrap(merkleProof(leaves, index));
    const root = unwrap(computeRoot(leaves));
    assert.equal(verifyProof(leaves[index]!, proof, root).ok, true);
  }
});

test('DB.3-T2 flipping any byte fails verification', () => {
  const size = 50;
  const leaves = randomLeaves(7, size).map((x: Uint8Array) => hashLeaf(x));
  const index = 11;
  const proof = unwrap(merkleProof(leaves, index));
  const root = unwrap(computeRoot(leaves));
  // flip a byte of the leaf
  const badLeafBytes = HashOps.toInternalBytes(leaves[index]!);
  badLeafBytes[0] = badLeafBytes[0]! ^ 0xff;
  const badLeaf = unwrap(HashOps.fromInternalBytes(badLeafBytes));
  assert.equal(verifyProof(badLeaf, proof, root).ok, false);
  // flip a byte of a sibling
  const badSibBytes = HashOps.toInternalBytes(proof.siblings[0]!);
  badSibBytes[0] = badSibBytes[0]! ^ 0xff;
  const badProof = { index, siblings: [unwrap(HashOps.fromInternalBytes(badSibBytes)), ...proof.siblings.slice(1)] };
  assert.equal(verifyProof(leaves[index]!, badProof, root).ok, false);
  // flip a byte of the root
  const badRootBytes = HashOps.toInternalBytes(root);
  badRootBytes[0] = badRootBytes[0]! ^ 0xff;
  assert.equal(verifyProof(leaves[index]!, proof, unwrap(HashOps.fromInternalBytes(badRootBytes))).ok, false);
});

test('DB.3-T3 wrong index fails', () => {
  const leaves = randomLeaves(3, 16).map((x: Uint8Array) => hashLeaf(x));
  const proof = unwrap(merkleProof(leaves, 4));
  const root = unwrap(computeRoot(leaves));
  const wrong = { index: 9, siblings: proof.siblings };
  assert.equal(verifyProof(leaves[4]!, wrong, root).ok, false);
});

test('DB.3-T4 too few/many siblings: SiblingCountMismatch when height known; no throw otherwise', () => {
  const leaves = randomLeaves(5, 16).map((x: Uint8Array) => hashLeaf(x));
  const index = 6;
  const proof = unwrap(merkleProof(leaves, index));
  const root = unwrap(computeRoot(leaves));
  const height = heightForLeafCount(16);
  const tooFew = { index, siblings: proof.siblings.slice(0, height - 1) };
  const tooMany = { index, siblings: [...proof.siblings, proof.siblings[0]!] };
  const r1 = verifyProof(leaves[index]!, tooFew, root, height);
  const r2 = verifyProof(leaves[index]!, tooMany, root, height);
  assert.equal(r1.ok, false);
  assert.equal(r2.ok, false);
  if (!r1.ok) assert.equal(r1.reason.kind, 'SiblingCountMismatch');
  // without expectedHeight it simply does not match, and never throws
  assert.doesNotThrow(() => reconstructRoot(leaves[index]!, tooFew));
  assert.equal(verifyProof(leaves[index]!, tooFew, root).ok, false);
});

test('DB.3-T5 proveAgainstChain ok when root anchored; RootNotAnchored when absent', () => {
  const leaves = randomLeaves(99, 8).map((x: Uint8Array) => hashLeaf(x));
  const index = 3;
  const proof = unwrap(merkleProof(leaves, index));
  const root = unwrap(computeRoot(leaves));
  const chain = new HeaderChain();
  // A chain that does not contain the root.
  assert.equal(proveAgainstChain(leaves[index]!, proof, root, chain).ok, false);
  const r = proveAgainstChain(leaves[index]!, proof, root, chain);
  if (!r.ok) assert.equal(r.reason.kind, 'RootNotAnchored');
});
