// Storage / retrieval measurements, taken from the REAL populated proof store.
// No formula is substituted for a measurement except the explicit baseline.
import { performance } from 'node:perf_hooks';
import type { Hash } from '@vaa/bsv';
import { heightForLeafCount, merkleProof } from '@vaa/merkle';
import { ProofStore, retrievalBytesAdversarial, retrievalBytesAssisted } from '@vaa/proofstore';
import { deterministicLeaves, deterministicSample, keyForIndex } from './population.js';

export function chooseLevel(n: number): number {
  const height = heightForLeafCount(n);
  return Math.max(1, Math.min(height - 1, Math.floor(Math.log2(n) / 2)));
}

export interface TimingStat {
  medianMs: number;
  minMs: number;
  maxMs: number;
}

export interface StorageMeasurement {
  study: 'storage';
  seed: number;
  n: number;
  q: number;
  treeHeight: number;
  predeterminedLevel: number;
  baselineFullProofBytes: number;
  baselineRederivedBytes: number;
  shardedStoredBytes: number;
  duplicateAvoidedBytes: number;
  avoidedRatioPpm: number;
  proofAssistanceBytesPerRoot: number;
  retrievalAdversarialBytes: number;
  retrievalAssistedBytes: number;
  // timings are LOCAL and excluded from the reproducible vector
  verifyTime: TimingStat;
  verifyWithAssistanceTime: TimingStat;
}

function timing(fn: () => void, iterations: number): TimingStat {
  const samples: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  return {
    medianMs: samples[Math.floor(samples.length / 2)] as number,
    minMs: samples[0] as number,
    maxMs: samples[samples.length - 1] as number,
  };
}

export function measureStorage(seed: number, n: number): StorageMeasurement {
  const leaves = deterministicLeaves(seed, n);
  const height = heightForLeafCount(n);
  const k = chooseLevel(n);
  const q = Math.min(n, 1000);
  const sample = deterministicSample(seed, n, q);

  const store = new ProofStore(k);
  for (const i of sample) {
    const r = store.anchor(keyForIndex(i), leaves, i);
    if (!r.ok) throw new Error('anchor failed in storage study');
  }

  const firstIndex = sample[0] as number;
  const firstQuery = store.query(keyForIndex(firstIndex));
  if (!firstQuery.ok) throw new Error('query failed in storage study');
  const stored = firstQuery.value;
  const root = stored.expectedRoot;

  // Baseline: the explicit formula AND a real re-derived count of full proofs.
  const baselineFullProofBytes = sample.length * height * 32;
  let baselineRederivedBytes = 0;
  for (const i of sample) {
    const p = merkleProof(leaves, i);
    if (p.ok) baselineRederivedBytes += p.value.siblings.length * 32;
  }

  const shardedStoredBytes = store.storedShardBytes();
  const duplicateAvoidedBytes = baselineFullProofBytes - shardedStoredBytes;
  const avoidedRatioPpm = Math.round((shardedStoredBytes / baselineFullProofBytes) * 1_000_000);
  const proofAssistanceBytesPerRoot = store.proofAssistanceBytes(root);

  const retrievalAdversarialBytes = retrievalBytesAdversarial(stored);
  const retrievalAssistedBytes = retrievalBytesAssisted(stored);

  const oneLeaf = leaves[firstIndex] as Hash;
  const verifyTime = timing(() => void store.verify(oneLeaf, stored, 'adversarial'), 50);
  const verifyWithAssistanceTime = timing(() => void store.verifyWithAssistance(oneLeaf, stored), 50);

  return {
    study: 'storage',
    seed,
    n,
    q: sample.length,
    treeHeight: height,
    predeterminedLevel: k,
    baselineFullProofBytes,
    baselineRederivedBytes,
    shardedStoredBytes,
    duplicateAvoidedBytes,
    avoidedRatioPpm,
    proofAssistanceBytesPerRoot,
    retrievalAdversarialBytes,
    retrievalAssistedBytes,
    verifyTime,
    verifyWithAssistanceTime,
  };
}

// The deterministic subset committed as a vector and diffed by `reproduce`
// (timings are excluded because they are local and not reproducible).
export function ciVector(m: StorageMeasurement): Record<string, number | string> {
  return {
    study: m.study,
    seed: m.seed,
    n: m.n,
    q: m.q,
    treeHeight: m.treeHeight,
    predeterminedLevel: m.predeterminedLevel,
    baselineFullProofBytes: m.baselineFullProofBytes,
    baselineRederivedBytes: m.baselineRederivedBytes,
    shardedStoredBytes: m.shardedStoredBytes,
    duplicateAvoidedBytes: m.duplicateAvoidedBytes,
    avoidedRatioPpm: m.avoidedRatioPpm,
    proofAssistanceBytesPerRoot: m.proofAssistanceBytesPerRoot,
    retrievalAdversarialBytes: m.retrievalAdversarialBytes,
    retrievalAssistedBytes: m.retrievalAssistedBytes,
  };
}
