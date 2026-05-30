import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HashOps } from '@vaa/bsv';
import { ProofStore, retrievalBytesAdversarial, retrievalBytesAssisted } from '@vaa/proofstore';
import {
  measureStorage,
  ciVector,
  chooseLevel,
  SEED,
  deterministicLeaves,
  deterministicSample,
  keyForIndex,
} from '@vaa/simstore';

function buildStore(n: number) {
  const leaves = deterministicLeaves(SEED, n);
  const store = new ProofStore(chooseLevel(n));
  const sample = deterministicSample(SEED, n, Math.min(n, 1000));
  for (const i of sample) store.anchor(keyForIndex(i), leaves, i);
  return { leaves, store, sample };
}

test('G.4 T-store-eff-1 sharded_stored_bytes <= baseline_full_proof_bytes for several N', () => {
  for (const n of [256, 1024]) {
    const m = measureStorage(SEED, n);
    assert.ok(m.shardedStoredBytes <= m.baselineFullProofBytes, `N=${n}: ${m.shardedStoredBytes} <= ${m.baselineFullProofBytes}`);
    assert.equal(m.baselineRederivedBytes, m.baselineFullProofBytes);
  }
});

test('G.4 T-store-eff-2 a tampered leaf among the sample is rejected at scale', () => {
  const { leaves, store, sample } = buildStore(1024);
  const idx = sample[10] as number;
  const stored = store.query(keyForIndex(idx));
  assert.equal(stored.ok, true);
  if (stored.ok) {
    const tampered = HashOps.toInternalBytes(leaves[idx]!);
    tampered[0] = tampered[0]! ^ 0xff;
    const bad = HashOps.fromInternalBytes(tampered).value;
    assert.equal(store.verify(bad, stored.value, 'adversarial').ok, false);
    assert.equal(store.verifyWithAssistance(bad, stored.value).ok, false);
  }
});

test('G.4 T-store-eff-3 the assisted retrieval payload is smaller and verifies from the lower shard alone', () => {
  const { leaves, store, sample } = buildStore(512);
  const idx = sample[3] as number;
  const stored = store.query(keyForIndex(idx));
  assert.equal(stored.ok, true);
  if (stored.ok) {
    assert.ok(retrievalBytesAssisted(stored.value) < retrievalBytesAdversarial(stored.value));
    const lowerOnly = { ...stored.value, shards: stored.value.shards.filter((s) => s.fromLevel === 0) };
    assert.equal(store.verifyWithAssistance(leaves[idx]!, lowerOnly).ok, true);
  }
});

test('G.4 T-store-eff-4 the CI-point vector regenerates byte-identically', () => {
  const a = JSON.stringify(ciVector(measureStorage(SEED, 256)));
  const b = JSON.stringify(ciVector(measureStorage(SEED, 256)));
  assert.equal(a, b);
});
