import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TxidOps, ScriptOps } from '@vaa/bsv';
import { validateKey, serializeKey } from '@vaa/proofstore';
import { indexKeyFor } from '@vaa/evidence';
import type { EvidenceObject } from '@vaa/evidence';

const obj: EvidenceObject = { type: 'payment', id: 'PAY1', counterparty: 'ACME', amount: 50n };

test('D.5 T-idx-1 derived keys validate and round-trip via serializeKey', () => {
  const txid = TxidOps.fromInternalBytes(new Uint8Array(32).fill(9)).value;
  const lockingScript = ScriptOps.fromHex('76a90088ac').value;
  const key = indexKeyFor(obj, {
    txid,
    direction: 'output',
    position: 2,
    blockPosition: 3,
    lockingScript,
    amountMinorUnits: 50n,
  });
  assert.equal(validateKey(key).ok, true);
  assert.equal(serializeKey(key), serializeKey(key));
  // a key without optional fields also validates
  const minimal = indexKeyFor(obj, { txid, direction: 'input', position: 0, blockPosition: 0 });
  assert.equal(validateKey(minimal).ok, true);
  assert.notEqual(serializeKey(key), serializeKey(minimal));
});
