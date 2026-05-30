import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pointMulG, scalarMod } from '@vaa/bsv';
import { sign, verify, isLowS, attestStructure, verifyAttestation, rootFromSeed } from '@vaa/keys';

test('K4-T1 sign/verify round-trip; tamper fails; low-S', () => {
  const priv = scalarMod(424242424242424242424242n);
  const pub = pointMulG(priv);
  const msg = new TextEncoder().encode('attest the period chain head');
  const sig = sign(priv, msg);
  assert.equal(verify(pub, msg, sig).ok, true);
  assert.equal(isLowS(sig), true);
  const tampered = new TextEncoder().encode('attest the period chain heaX');
  const r = verify(pub, tampered, sig);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason.kind, 'BadSignature');
});

test('K4-T2 attestStructure verifies under the root; a wrong root fails', () => {
  const { rootPriv, rootPub } = rootFromSeed(new TextEncoder().encode('entity-1'));
  const other = rootFromSeed(new TextEncoder().encode('entity-2'));
  const digest = new TextEncoder().encode('period-2026-Q1 chain head digest');
  const sig = attestStructure(rootPriv, digest);
  assert.equal(verifyAttestation(rootPub, digest, sig).ok, true);
  assert.equal(verifyAttestation(other.rootPub, digest, sig).ok, false);
});
