// The proof store (availability-only). It anchors items into a tree, shards each
// proof at the predetermined level, stores the per-item lower shard and the
// shared upper shard once per root, and serves queries. It is never a trust root.
import type { Hash, VerifyResult } from '@vaa/bsv';
import { hashNode, HashOps, verifyOk, verifyFail } from '@vaa/bsv';
import { merkleProof, computeRoot, verifyProof } from '@vaa/merkle';
import type { IndexKey } from './indexkey.js';
import { validateKey, serializeKey } from './indexkey.js';
import type { ProofShard, StoredProof } from './shard.js';
import { shardProof, reassemble } from './shard.js';
import type { ProofAssistance } from './assistance.js';
import { computeProofAssistance, labelsHashToRoot } from './assistance.js';
import { serialiseShard } from './payload.js';
import type { StoreError, StoreVerifyReason } from './errors.js';
import { keyNotFound } from './errors.js';
import { ok, err } from '@vaa/bsv';

interface StoredItem {
  key: IndexKey;
  leafIndex: number;
  lowerShard: ProofShard;
  expectedRoot: Hash;
}

export class ProofStore {
  private readonly predeterminedLevel: number;
  private readonly items = new Map<string, StoredItem>();
  // The shared upper structure is the proof-assistance node labels, stored once
  // per root. Each item's upper shard (level-k node up to the root) is DERIVED
  // from these labels, so it is never duplicated per item.
  private readonly assistanceByRoot = new Map<string, ProofAssistance>();

  constructor(predeterminedLevel: number) {
    this.predeterminedLevel = predeterminedLevel;
  }

  anchor(key: IndexKey, leaves: Hash[], leafIndex: number): { ok: true; value: Hash } | { ok: false; error: StoreError } {
    const v = validateKey(key);
    if (!v.ok) return err(v.error);
    const proof = merkleProof(leaves, leafIndex);
    if (!proof.ok) return err({ kind: 'ShardNonContiguous', message: proof.error.message });
    const shards = shardProof(proof.value, this.predeterminedLevel);
    if (!shards.ok) return err(shards.error);
    const root = computeRoot(leaves);
    if (!root.ok) return err({ kind: 'ShardNonContiguous', message: root.error.message });
    const rootHex = HashOps.toDisplayHex(root.value);

    const [lower] = shards.value as [ProofShard, ProofShard];
    this.items.set(serializeKey(key), { key, leafIndex, lowerShard: lower, expectedRoot: root.value });

    const assist = computeProofAssistance(leaves, this.predeterminedLevel);
    if (!assist.ok) return err(assist.error);
    if (!this.assistanceByRoot.has(rootHex)) this.assistanceByRoot.set(rootHex, assist.value);
    return ok(root.value);
  }

  // Derive an item's upper shard (level-k node up to the root) from the shared
  // proof-assistance labels: the labels ARE the level-k nodes, so the upper path
  // is a Merkle path within the labels.
  private deriveUpperShard(assist: ProofAssistance, leafIndex: number): ProofShard | undefined {
    const k = assist.predeterminedLevel;
    const labelPos = leafIndex >> k;
    const upperProof = merkleProof(assist.nodeLabels, labelPos);
    if (!upperProof.ok) return undefined;
    return { fromLevel: k, toLevel: k + upperProof.value.siblings.length, siblings: upperProof.value.siblings };
  }

  query(key: IndexKey): { ok: true; value: StoredProof } | { ok: false; error: StoreError } {
    const keyHex = serializeKey(key);
    const item = this.items.get(keyHex);
    if (item === undefined) return err(keyNotFound(keyHex));
    const assist = this.assistanceByRoot.get(HashOps.toDisplayHex(item.expectedRoot));
    const upper = assist === undefined ? undefined : this.deriveUpperShard(assist, item.leafIndex);
    const shards = upper === undefined ? [item.lowerShard] : [item.lowerShard, upper];
    // Only this item's fragment plus shared public structure; nothing about any
    // other record.
    return ok({ key: item.key, leafIndex: item.leafIndex, shards, expectedRoot: item.expectedRoot });
  }

  proofAssistanceFor(root: Hash): ProofAssistance | undefined {
    return this.assistanceByRoot.get(HashOps.toDisplayHex(root));
  }

  verify(leaf: Hash, stored: StoredProof, mode: 'adversarial' | 'trustedOperational'): VerifyResult<StoreVerifyReason> {
    if (mode === 'trustedOperational') {
      // The audit path refuses the trusted-operational mode.
      return verifyFail({ kind: 'TrustedOperationalNotAcceptedForAudit' });
    }
    const proof = reassemble(stored);
    if (!proof.ok) return verifyFail({ kind: 'ShardNonContiguous' });
    const r = verifyProof(leaf, proof.value, stored.expectedRoot);
    if (r.ok) return verifyOk();
    return verifyFail({ kind: 'RootMismatch' });
  }

  verifyWithAssistance(leaf: Hash, stored: StoredProof): VerifyResult<StoreVerifyReason> {
    const lower = stored.shards.find((s) => s.fromLevel === 0);
    if (lower === undefined) return verifyFail({ kind: 'ShardNonContiguous' });
    const assist = this.proofAssistanceFor(stored.expectedRoot);
    if (assist === undefined) return verifyFail({ kind: 'AssistanceRootMismatch' });

    let cur = leaf;
    let idx = stored.leafIndex;
    for (const sib of lower.siblings) {
      if ((idx & 1) === 0) cur = hashNode(cur, sib);
      else cur = hashNode(sib, cur);
      idx = idx >> 1;
    }
    const labelPos = stored.leafIndex >> assist.predeterminedLevel;
    const label = assist.nodeLabels[labelPos];
    if (label === undefined || !HashOps.equals(cur, label)) {
      return verifyFail({ kind: 'AssistanceMismatch' });
    }
    const r = labelsHashToRoot(assist, stored.expectedRoot);
    if (r.ok) return verifyOk();
    return verifyFail({ kind: 'AssistanceRootMismatch' });
  }

  // Measurement: total bytes the store actually holds — each item's lower shard
  // plus the shared proof-assistance labels counted once per root.
  storedShardBytes(): number {
    let total = 0;
    for (const item of this.items.values()) total += serialiseShard(item.lowerShard).length;
    for (const assist of this.assistanceByRoot.values()) {
      total += 12 + assist.nodeLabels.length * 32; // labels stored once per root
    }
    return total;
  }

  // Bytes of the shared proof-assistance for a root (counted once).
  proofAssistanceBytes(root: Hash): number {
    const assist = this.assistanceByRoot.get(HashOps.toDisplayHex(root));
    if (assist === undefined) return 0;
    return 12 + assist.nodeLabels.length * 32;
  }

  itemCount(): number {
    return this.items.size;
  }

  rootCount(): number {
    return this.assistanceByRoot.size;
  }

  level(): number {
    return this.predeterminedLevel;
  }
}
