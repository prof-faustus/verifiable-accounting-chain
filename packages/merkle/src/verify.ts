// Verification. reconstructRoot folds a leaf upward using the proof; it never
// throws on adversarial input — a bad proof simply yields a value that will not
// match. proveAgainstChain anchors the result in the validated BSV header chain.
import type { Hash, VerifyResult, HeaderChain } from '@vaa/bsv';
import { hashNode, HashOps, verifyOk, verifyFail } from '@vaa/bsv';
import type { MerkleProof } from './proof.js';
import type { MerkleVerifyReason } from './errors.js';

export function reconstructRoot(leaf: Hash, proof: MerkleProof): Hash {
  let cur = leaf;
  let idx = proof.index;
  for (const sib of proof.siblings) {
    if ((idx & 1) === 0) {
      cur = hashNode(cur, sib); // current node is the left child
    } else {
      cur = hashNode(sib, cur); // current node is the right child
    }
    idx = idx >> 1;
  }
  return cur;
}

// expectedHeight (when known by the caller) lets verifyProof report a
// SiblingCountMismatch; otherwise it simply reconstructs and compares.
export function verifyProof(
  leaf: Hash,
  proof: MerkleProof,
  root: Hash,
  expectedHeight?: number,
): VerifyResult<MerkleVerifyReason> {
  if (expectedHeight !== undefined && proof.siblings.length !== expectedHeight) {
    return verifyFail({ kind: 'SiblingCountMismatch', got: proof.siblings.length, expected: expectedHeight });
  }
  const recomputed = reconstructRoot(leaf, proof);
  if (HashOps.equals(recomputed, root)) return verifyOk();
  return verifyFail({ kind: 'RootMismatch' });
}

export function proveAgainstChain(
  leaf: Hash,
  proof: MerkleProof,
  root: Hash,
  chain: HeaderChain,
  expectedHeight?: number,
): VerifyResult<MerkleVerifyReason> {
  const v = verifyProof(leaf, proof, root, expectedHeight);
  if (!v.ok) return v;
  if (chain.containsMerkleRoot(root) === undefined) {
    return verifyFail({ kind: 'RootNotAnchored' });
  }
  return verifyOk();
}

// The tree height implied by a leaf count (number of sibling levels in a proof).
export function heightForLeafCount(leafCount: number): number {
  if (leafCount <= 1) return 0;
  let height = 0;
  let size = 1;
  while (size < leafCount) {
    size *= 2;
    height++;
  }
  return height;
}
