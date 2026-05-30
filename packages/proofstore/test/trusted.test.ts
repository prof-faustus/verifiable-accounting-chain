import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeProofAssistance, homomorphicCommitment, verifyTrustedOperational, ProofStore } from '@vaa/proofstore';
import { makeLeaves, makeKey, unwrap } from './util.mjs';

test('C.6 T-trusted-1 the homomorphic sum is computed and verifies on genuine data', () => {
  const leaves = makeLeaves(21, 16);
  const assist = unwrap(computeProofAssistance(leaves, 2));
  const commitment = homomorphicCommitment(assist.nodeLabels);
  assert.equal(typeof commitment, 'string');
  assert.ok(commitment.length > 0);
  assert.equal(verifyTrustedOperational(assist.nodeLabels, commitment).ok, true);
  // an altered label set does not verify against the original commitment
  const altered = assist.nodeLabels.slice();
  altered[0] = altered[1]!;
  assert.equal(verifyTrustedOperational(altered, commitment).ok, false);
});

test('C.6 T-trusted-2 the audit path refuses trustedOperational', () => {
  const leaves = makeLeaves(22, 16);
  const store = new ProofStore(2);
  unwrap(store.anchor(makeKey(0), leaves, 0));
  const stored = unwrap(store.query(makeKey(0)));
  const r = store.verify(leaves[0]!, stored, 'trustedOperational');
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason.kind, 'TrustedOperationalNotAcceptedForAudit');
});
