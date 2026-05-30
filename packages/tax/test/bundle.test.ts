import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HeaderChain } from '@vaa/bsv';
import { issueTaxBundle, verifyTaxBundle, TAX_TAGS } from '@vaa/tax';
import { buildTaxScenario } from './util.mjs';

function issue(s: ReturnType<typeof buildTaxScenario>) {
  return issueTaxBundle(s.taxTx, [TAX_TAGS.output, TAX_TAGS.input, TAX_TAGS.payable], s.chain, s.chainIndex, { inclusion: s.inclusion });
}

test('TX4-T1 a VAT tax bundle verifies end to end; no non-tax field value present', () => {
  const s = buildTaxScenario(200n, 80n);
  const bundle = issue(s);
  assert.equal(bundle.ok, true);
  if (!bundle.ok) return;
  assert.equal(verifyTaxBundle(s.rootPub, s.genesisMsg, s.headerChain, s.map, s.accountPath, bundle.value, s.declared).ok, true);
  // only tax fields disclosed; no customer.name
  for (const f of bundle.value.disclosedFields) assert.ok(f.tag.startsWith('tax.'));
  assert.equal(bundle.value.disclosedFields.some((f) => f.tag === 'customer.name'), false);
});

test('TX4-T2 tampered figure, mis-mapped field, unanchored, broken link each fail', () => {
  const s = buildTaxScenario(200n, 80n);
  const bundle = issue(s);
  assert.equal(bundle.ok, true);
  if (!bundle.ok) return;

  // wrong declared payable -> recompute mismatch
  const wrongDeclared = { ...s.declared, payable: 999n };
  assert.equal(verifyTaxBundle(s.rootPub, s.genesisMsg, s.headerChain, s.map, s.accountPath, bundle.value, wrongDeclared).ok, false);

  // mis-mapped: verify against a wrong account path -> MappingInvalid
  const r2 = verifyTaxBundle(s.rootPub, s.genesisMsg, s.headerChain, s.map, ['GL', 'WRONG'], bundle.value, s.declared);
  assert.equal(r2.ok, false);
  if (!r2.ok) assert.equal(r2.reason.kind, 'MappingInvalid');

  // unanchored -> BundleInvalid (NotAnchored)
  const r3 = verifyTaxBundle(s.rootPub, s.genesisMsg, new HeaderChain(), s.map, s.accountPath, bundle.value, s.declared);
  assert.equal(r3.ok, false);
  if (!r3.ok) assert.equal(r3.reason.kind, 'BundleInvalid');

  // broken chain link -> BundleInvalid (ChainEvidenceInvalid)
  const sig = Uint8Array.from(bundle.value.chainLinkProof.signature);
  sig[sig.length - 1] ^= 0xff;
  const tampered = { ...bundle.value, chainLinkProof: { ...bundle.value.chainLinkProof, signature: sig } };
  assert.equal(verifyTaxBundle(s.rootPub, s.genesisMsg, s.headerChain, s.map, s.accountPath, tampered, s.declared).ok, false);
});

test('TX4-T3 the tax bundle size is small, independent of the number of non-tax fields', () => {
  const s = buildTaxScenario(200n, 80n);
  const bundle = issue(s);
  assert.equal(bundle.ok, true);
  if (bundle.ok) {
    // 3 disclosed tax figures, each with a log-sized path (4 fields -> height 2)
    assert.equal(bundle.value.disclosedFields.length, 3);
    for (const fp of bundle.value.fieldProofs) assert.ok(fp.path.siblings.length <= 4);
  }
});
