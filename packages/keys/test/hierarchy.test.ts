import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pointMulG, pointEq, pointToHex } from '@vaa/bsv';
import { rootFromSeed, derivePathPub, derivePathPriv, verifyNodeUnderRoot } from '@vaa/keys';

const seed = new TextEncoder().encode('entity-acme-2026');

test('K3-T1 a field nodeKey derived publicly equals the private derivation public key', () => {
  const { rootPriv, rootPub } = rootFromSeed(seed);
  const path = ['GL', '1000-Cash', 'sub-3', 'field:balance'];
  const pub = derivePathPub(rootPub, path);
  const priv = derivePathPriv(rootPriv, path);
  assert.equal(pub.ok && priv.ok, true);
  if (pub.ok && priv.ok) assert.equal(pointEq(pub.value, pointMulG(priv.value)), true);
});

test('K3-T2 verifyNodeUnderRoot accepts genuine, rejects off-by-one path', () => {
  const { rootPub } = rootFromSeed(seed);
  const path = ['GL', '4000-Sales', 'field:net'];
  const claimed = derivePathPub(rootPub, path);
  assert.equal(claimed.ok, true);
  if (claimed.ok) {
    assert.equal(verifyNodeUnderRoot(rootPub, path, claimed.value).ok, true);
    const r = verifyNodeUnderRoot(rootPub, ['GL', '4000-Sales', 'field:tax'], claimed.value);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason.kind, 'NotUnderRoot');
  }
});

test('K3-T3 hundreds of ledger fields each derive a distinct root-anchored key', () => {
  const { rootPub } = rootFromSeed(seed);
  const seen = new Set<string>();
  for (let i = 0; i < 300; i++) {
    const pub = derivePathPub(rootPub, ['GL', `acct-${i}`, `field:${i}`]);
    assert.equal(pub.ok, true);
    if (pub.ok) {
      const hex = pointToHex(pub.value);
      assert.equal(seen.has(hex), false);
      seen.add(hex);
    }
  }
  assert.equal(seen.size, 300);
});
