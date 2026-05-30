import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTransaction, txid, inputs, outputs, TxidOps, ScriptOps } from '@vaa/bsv';
import { txFixture, hexToBytes, unwrap } from './load.mjs';

test('DA.7-T1 parse a genuine multi-in/multi-out tx', () => {
  const raw = hexToBytes(txFixture.rawHex);
  const tx = unwrap(parseTransaction(raw));
  assert.equal(inputs(tx).length, txFixture.inputCount);
  assert.equal(outputs(tx).length, txFixture.outputCount);
  for (const o of outputs(tx)) {
    const expected = txFixture.outputs[o.position];
    assert.equal(o.amountMinorUnits, BigInt(expected.amountMinorUnits));
    assert.equal(ScriptOps.length(o.lockingScript), expected.lockingScriptLength);
    assert.equal(typeof o.amountMinorUnits, 'bigint');
    assert.ok(o.amountMinorUnits >= 0n);
  }
  assert.equal(TxidOps.toDisplayHex(txid(tx)), txFixture.txid);
});

test('DA.7-T2 truncation and corrupt length prefix', () => {
  const raw = hexToBytes(txFixture.rawHex);
  const t1 = parseTransaction(raw.subarray(0, raw.length - 1));
  assert.equal(t1.ok, false);
  if (!t1.ok) assert.equal(t1.error.kind, 'TxTruncated');
  const th = parseTransaction(raw.subarray(0, Math.floor(raw.length / 2)));
  assert.equal(th.ok, false);
  if (!th.ok) assert.equal(th.error.kind, 'TxTruncated');
  const corrupt = Uint8Array.from(raw);
  corrupt[4] = 0xff; // bump the input-count varint into an impossible value
  const tc = parseTransaction(corrupt);
  assert.equal(tc.ok, false);
  if (!tc.ok) assert.equal(tc.error.kind, 'TxMalformed');
});

test('DA.7-T3 a zero-amount output parses with 0n', () => {
  // version | 0 inputs | 1 output (value 0, empty script) | locktime
  const raw = Uint8Array.of(
    0x01, 0x00, 0x00, 0x00, // version
    0x00, // input count
    0x01, // output count
    0, 0, 0, 0, 0, 0, 0, 0, // value 0
    0x00, // script length 0
    0x00, 0x00, 0x00, 0x00, // locktime
  );
  const tx = unwrap(parseTransaction(raw));
  assert.equal(outputs(tx).length, 1);
  assert.equal(outputs(tx)[0]!.amountMinorUnits, 0n);
});
