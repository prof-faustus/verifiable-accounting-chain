import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TxidOps, ScriptOps } from '@vaa/bsv';
import { serializeKey, validateKey } from '@vaa/proofstore';
import type { IndexKey } from '@vaa/proofstore';
import { makeKey } from './util.mjs';

const baseTxid = TxidOps.fromInternalBytes(new Uint8Array(32).fill(1)).value;
const script = ScriptOps.fromHex('76a90088ac').value;

const full: IndexKey = {
  txid: baseTxid,
  direction: 'input',
  position: 3,
  blockPosition: 7,
  lockingScript: script,
  unlockingScript: script,
  amountMinorUnits: 12345n,
};

test('DC.1-T1 serializeKey stable with and without optional fields', () => {
  const minimal: IndexKey = { txid: baseTxid, direction: 'output', position: 0, blockPosition: 0 };
  assert.equal(serializeKey(full), serializeKey({ ...full }));
  assert.equal(serializeKey(minimal), serializeKey({ ...minimal }));
  assert.notEqual(serializeKey(full), serializeKey(minimal));
});

test('DC.1-T2 changing any field yields a distinct string', () => {
  const base = serializeKey(full);
  const otherTxid = TxidOps.fromInternalBytes(new Uint8Array(32).fill(2)).value;
  const otherScript = ScriptOps.fromHex('76a91488ac').value;
  assert.notEqual(serializeKey({ ...full, txid: otherTxid }), base);
  assert.notEqual(serializeKey({ ...full, direction: 'output' }), base);
  assert.notEqual(serializeKey({ ...full, position: 4 }), base);
  assert.notEqual(serializeKey({ ...full, blockPosition: 8 }), base);
  assert.notEqual(serializeKey({ ...full, lockingScript: otherScript }), base);
  assert.notEqual(serializeKey({ ...full, unlockingScript: otherScript }), base);
  assert.notEqual(serializeKey({ ...full, amountMinorUnits: 99n }), base);
});

test('DC.1-T3 validateKey rejects negatives', () => {
  assert.equal(validateKey({ ...makeKey(1), position: -1 }).ok, false);
  assert.equal(validateKey({ ...makeKey(1), blockPosition: -1 }).ok, false);
  assert.equal(validateKey({ ...makeKey(1), amountMinorUnits: -1n }).ok, false);
  assert.equal(validateKey(makeKey(1)).ok, true);
});
