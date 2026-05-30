import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HeaderChain } from '@vaa/bsv';
import { verifyTripleEntry, detectUnmatched } from '@vaa/tripleentry';
import { buildTriple, txidAt } from './util.mjs';

test('TE3-T1 a genuine triple entry whose shared root is anchored verifies ok', () => {
  const { te, headerChain } = buildTriple(100n, 100n);
  assert.equal(te.ok, true);
  if (te.ok) assert.equal(verifyTripleEntry(te.value, headerChain).ok, true);
});

test('TE3-T2 a side that disagrees with the shared entry -> SideMismatch', () => {
  // postings balance (90 == 90) but the shared committed amount is 100
  const { te, headerChain } = buildTriple(90n, 100n);
  assert.equal(te.ok, true);
  if (te.ok) {
    const r = verifyTripleEntry(te.value, headerChain);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason.kind, 'SideMismatch');
  }
});

test('TE3-T3 a side pointing at a different shared entry -> SharedEntryNotReferenced', () => {
  const { te, headerChain } = buildTriple(100n, 100n);
  assert.equal(te.ok, true);
  if (te.ok) {
    const tampered = { ...te.value, debitSide: { ...te.value.debitSide, sharedEntryRef: { txid: txidAt(99), vout: 0 } } };
    const r = verifyTripleEntry(tampered, headerChain);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason.kind, 'SharedEntryNotReferenced');
  }
});

test('TE3-T4 an unanchored shared root -> NotAnchored', () => {
  const { te } = buildTriple(100n, 100n);
  assert.equal(te.ok, true);
  if (te.ok) {
    const r = verifyTripleEntry(te.value, new HeaderChain());
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason.kind, 'NotAnchored');
  }
});

test('TE3-T5 detectUnmatched flags a debit with no matching credit and vice versa', () => {
  const a = buildTriple(100n, 100n, 1);
  const b = buildTriple(50n, 50n, 2);
  if (!a.te.ok || !b.te.ok) throw new Error('build failed');
  const debitSides = [a.te.value.debitSide, b.te.value.debitSide];
  const creditSides = [a.te.value.creditSide]; // b's credit is missing
  const result = detectUnmatched(debitSides, creditSides);
  assert.equal(result.unmatchedDebits.length, 1);
  assert.equal(result.unmatchedDebits[0]!.sharedEntryRef.vout, 0);
  assert.equal(result.unmatchedCredits.length, 0);
});
