// Merkle Proof Entity tree construction (WO 2022/100946).
//
// A leaf node is the double-SHA256 of its data item (supplied already hashed
// here). An internal node is hashNode(left, right) over the internal-order
// concatenation. At an odd level the last node is paired with itself.
//
// In this system the leaves are the FIELDS of one accounting transaction (the
// evidence package supplies the field-leaves and their order); the same
// primitive also reconstructs a block's transaction-id tree to prove the
// committing transaction's inclusion in a block.
import type { Hash, Txid, Result } from '@vaa/bsv';
import { hashNode, HashOps, TxidOps, ok, err } from '@vaa/bsv';
import type { MerkleError } from './errors.js';
import { emptyLeaves } from './errors.js';

export interface MerkleTree {
  readonly root: Hash;
  readonly levels: Hash[][];
}

function nextLevel(current: readonly Hash[]): Hash[] {
  const next: Hash[] = [];
  for (let i = 0; i < current.length; i += 2) {
    const left = current[i] as Hash;
    const right = (i + 1 < current.length ? current[i + 1] : current[i]) as Hash;
    next.push(hashNode(left, right));
  }
  return next;
}

export function buildTree(leaves: Hash[]): Result<MerkleTree, MerkleError> {
  if (leaves.length === 0) return err(emptyLeaves());
  const levels: Hash[][] = [leaves.map((l) => l)];
  let current = levels[0] as Hash[];
  while (current.length > 1) {
    const next = nextLevel(current);
    levels.push(next);
    current = next;
  }
  return ok({ root: current[0] as Hash, levels });
}

export function computeRoot(leaves: Hash[]): Result<Hash, MerkleError> {
  if (leaves.length === 0) return err(emptyLeaves());
  let current: Hash[] = leaves.map((l) => l);
  while (current.length > 1) {
    current = nextLevel(current);
  }
  return ok(current[0] as Hash);
}

export function leafIndexOfTxid(leaves: Hash[], txid: Txid): number | undefined {
  const target = TxidOps.asHash(txid);
  for (let i = 0; i < leaves.length; i++) {
    if (HashOps.equals(leaves[i] as Hash, target)) return i;
  }
  return undefined;
}
