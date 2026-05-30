// Retrieval payload accounting. Sizes are measured from the actual serialised
// fragments, not estimated.
import { concat, writeU32LE, HashOps } from '@vaa/bsv';
import type { ProofShard, StoredProof } from './shard.js';

// A shard serialises as: fromLevel(4) | toLevel(4) | count(4) | siblings(32 each).
export function serialiseShard(shard: ProofShard): Uint8Array {
  const header = new Uint8Array(12);
  writeU32LE(shard.fromLevel, header, 0);
  writeU32LE(shard.toLevel, header, 4);
  writeU32LE(shard.siblings.length, header, 8);
  const body = concat(...shard.siblings.map((h) => HashOps.toInternalBytes(h)));
  return concat(header, body);
}

export function retrievalBytesAdversarial(stored: StoredProof): number {
  let total = 0;
  for (const shard of stored.shards) total += serialiseShard(shard).length;
  return total;
}

export function retrievalBytesAssisted(stored: StoredProof): number {
  const lower = stored.shards.find((s) => s.fromLevel === 0);
  if (lower === undefined) return 0;
  return serialiseShard(lower).length;
}
