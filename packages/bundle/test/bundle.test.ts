import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HashOps, HeaderChain } from '@vaa/bsv';
import { heightForLeafCount } from '@vaa/merkle';
import { issueBundle, verifyBundle } from '@vaa/bundle';
import { buildScenario, issueVatBundle, buildScenarioMultiInclusion } from './util.mjs';

function unwrap<T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!r.ok) throw new Error('unexpected error ' + JSON.stringify(r.error));
  return r.value;
}

function contains(haystack: Uint8Array, needle: Uint8Array): boolean {
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) if (haystack[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}

test('B-T1 a VAT-total bundle for a 1000-field invoice verifies end to end; no other field value present', () => {
  const s = buildScenario(1000, 500);
  const bundle = unwrap(issueVatBundle(s));
  assert.equal(verifyBundle(s.rootPub, s.genesisMsg, s.headerChain, bundle).ok, true);

  assert.equal(bundle.disclosedFields.length, 1);
  assert.equal(bundle.disclosedFields[0]!.tag, 'tax.vatPayable');

  const disclosed = new Uint8Array([
    ...bundle.disclosedFields.flatMap((f) => Array.from(f.value)),
    ...bundle.fieldProofs.flatMap((p) => p.path.siblings.flatMap((h) => Array.from(HashOps.toInternalBytes(h)))),
  ]);
  for (let i = 0; i < s.tx.fields.length; i++) {
    if (i === s.vatIndex) continue;
    const v = s.tx.fields[i]!.value;
    if (v.length >= 4) assert.equal(contains(disclosed, v), false);
  }
});

test('B-T2 each failure path returns its reason', () => {
  const s = buildScenario(256, 7);
  const bundle = unwrap(issueVatBundle(s));

  // tamper the disclosed value -> ProofInvalid
  const tamperedValue = Uint8Array.from(bundle.disclosedFields[0]!.value);
  tamperedValue[1] ^= 0xff;
  const t1 = verifyBundle(s.rootPub, s.genesisMsg, s.headerChain, {
    ...bundle,
    disclosedFields: [{ tag: bundle.disclosedFields[0]!.tag, value: tamperedValue }],
  });
  assert.equal(t1.ok, false);
  if (!t1.ok) assert.equal(t1.reason.kind, 'ProofInvalid');

  // tamper the chain link -> ChainEvidenceInvalid
  const sig = Uint8Array.from(bundle.chainLinkProof.signature);
  sig[sig.length - 1] ^= 0xff;
  const t2 = verifyBundle(s.rootPub, s.genesisMsg, s.headerChain, { ...bundle, chainLinkProof: { ...bundle.chainLinkProof, signature: sig } });
  assert.equal(t2.ok, false);
  if (!t2.ok) assert.equal(t2.reason.kind, 'ChainEvidenceInvalid');

  // unanchored: verify against an empty header chain -> NotAnchored
  const t3 = verifyBundle(s.rootPub, s.genesisMsg, new HeaderChain(), bundle);
  assert.equal(t3.ok, false);
  if (!t3.ok) assert.equal(t3.reason.kind, 'NotAnchored');
});

test('B-T4 the bundle anchors via a genuine multi-transaction inclusion proof (non-trivial Merkle path)', () => {
  // block of 8 transactions, ours at position 5 -> a 3-sibling inclusion path
  const s = buildScenarioMultiInclusion(256, 7, 8, 5);
  assert.ok(s.pathSiblings >= 3, 'inclusion path should have real siblings');
  const bundle = unwrap(issueBundle(s.tx, [s.vatIndex], s.chain, s.chainIndex, { inclusion: s.inclusion }));
  assert.equal(bundle.inclusion.merklePath.siblings.length, s.pathSiblings);
  assert.equal(verifyBundle(s.rootPub, s.genesisMsg, s.headerChain, bundle).ok, true);

  // tampering any inclusion sibling breaks the fold to the block root -> NotAnchored
  const sib = HashOps.toInternalBytes(bundle.inclusion.merklePath.siblings[0]!);
  sib[0] ^= 0xff;
  const tampered = { ...bundle, inclusion: { ...bundle.inclusion, merklePath: { index: bundle.inclusion.merklePath.index, siblings: [HashOps.fromInternalBytes(sib).value, ...bundle.inclusion.merklePath.siblings.slice(1)] } } };
  const r = verifyBundle(s.rootPub, s.genesisMsg, s.headerChain, tampered);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason.kind, 'NotAnchored');
});

test('B-T3 bundle size is O(disclosed + log fields), independent of total field count', () => {
  for (const count of [128, 1024, 4096]) {
    const s = buildScenario(count, 3);
    const bundle = unwrap(issueVatBundle(s));
    assert.equal(bundle.disclosedFields.length, 1);
    assert.equal(bundle.fieldProofs[0]!.path.siblings.length, heightForLeafCount(count));
    // even at 4096 fields the path is ~12 siblings, not thousands.
    assert.ok(bundle.fieldProofs[0]!.path.siblings.length <= 16);
  }
});
