import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TxidOps } from '@vaa/bsv';
import { txFixture, hexToBytes, unwrap } from './load.mjs';

test('DA.5-equivalent: ofTransactionBytes(genuine raw) equals published txid', () => {
  const raw = hexToBytes(txFixture.rawHex);
  const t = TxidOps.ofTransactionBytes(raw);
  assert.equal(TxidOps.toDisplayHex(t), txFixture.txid);
});

test('display <-> internal round-trip on a genuine txid', () => {
  const t = unwrap(TxidOps.fromDisplayHex(txFixture.txid));
  assert.equal(TxidOps.toDisplayHex(t), txFixture.txid);
  const back = unwrap(TxidOps.fromInternalBytes(TxidOps.toInternalBytes(t)));
  assert.equal(TxidOps.equals(t, back), true);
});

test('asHash exposes the same internal bytes', () => {
  const t = unwrap(TxidOps.fromDisplayHex(txFixture.txid));
  assert.deepEqual(Array.from(TxidOps.asHash(t)), Array.from(TxidOps.toInternalBytes(t)));
});

test('fromDisplayHex rejects bad length and charset', () => {
  assert.equal(TxidOps.fromDisplayHex('00').ok, false);
  assert.equal(TxidOps.fromDisplayHex('z'.repeat(64)).ok, false);
});
