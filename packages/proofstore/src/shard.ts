// Proof shards (Selective Verification claims 2-3). A proof is split into two
// non-overlapping portions at a predetermined level: a lower portion (per item)
// and an upper portion (shared across items committed to the same root).
import type { Hash, Result } from '@vaa/bsv';
import { ok, err } from '@vaa/bsv';
import type { MerkleProof } from '@vaa/merkle';
import type { IndexKey } from './indexkey.js';
import type { StoreError } from './errors.js';
import { shardBadLevel, shardNonContiguous } from './errors.js';

export interface ProofShard {
  readonly fromLevel: number;
  readonly toLevel: number;
  readonly siblings: Hash[];
}

export interface StoredProof {
  readonly key: IndexKey;
  readonly leafIndex: number;
  readonly shards: ProofShard[];
  readonly expectedRoot: Hash;
}

export function shardProof(proof: MerkleProof, predeterminedLevel: number): Result<ProofShard[], StoreError> {
  const height = proof.siblings.length;
  if (predeterminedLevel <= 0 || predeterminedLevel >= height) {
    return err(shardBadLevel(predeterminedLevel, height));
  }
  const lower: ProofShard = {
    fromLevel: 0,
    toLevel: predeterminedLevel,
    siblings: proof.siblings.slice(0, predeterminedLevel),
  };
  const upper: ProofShard = {
    fromLevel: predeterminedLevel,
    toLevel: height,
    siblings: proof.siblings.slice(predeterminedLevel, height),
  };
  return ok([lower, upper]);
}

export function reassemble(stored: StoredProof): Result<MerkleProof, StoreError> {
  const shards = [...stored.shards].sort((x, y) => x.fromLevel - y.fromLevel);
  let expect = 0;
  let siblings: Hash[] = [];
  for (const s of shards) {
    if (s.fromLevel !== expect) return err(shardNonContiguous());
    if (s.siblings.length !== s.toLevel - s.fromLevel) return err(shardNonContiguous());
    siblings = siblings.concat(s.siblings);
    expect = s.toLevel;
  }
  return ok({ index: stored.leafIndex, siblings });
}
