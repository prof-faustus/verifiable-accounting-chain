// Merkle path generation. The sibling list runs from the leaf level up to (not
// including) the root; at an odd boundary where a node is self-paired, the
// sibling is the node itself.
import type { Hash, Result } from '@vaa/bsv';
import { ok, err } from '@vaa/bsv';
import type { MerkleError } from './errors.js';
import { indexOutOfRange } from './errors.js';
import { buildTree } from './tree.js';

export interface MerkleProof {
  readonly index: number;
  readonly siblings: Hash[];
}

export function merkleProof(leaves: Hash[], index: number): Result<MerkleProof, MerkleError> {
  if (index < 0 || index >= leaves.length) return err(indexOutOfRange(index, leaves.length));
  const tree = buildTree(leaves);
  if (!tree.ok) return err(tree.error);
  const siblings: Hash[] = [];
  let pos = index;
  for (let level = 0; level < tree.value.levels.length - 1; level++) {
    const nodes = tree.value.levels[level] as Hash[];
    let sib: Hash;
    if (pos % 2 === 0) {
      sib = (pos + 1 < nodes.length ? nodes[pos + 1] : nodes[pos]) as Hash; // odd: sibling is self
    } else {
      sib = nodes[pos - 1] as Hash;
    }
    siblings.push(sib);
    pos = Math.floor(pos / 2);
  }
  return ok({ index, siblings });
}
