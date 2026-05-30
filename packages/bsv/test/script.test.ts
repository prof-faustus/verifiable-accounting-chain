import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ScriptOps } from '@vaa/bsv';
import { txFixture, unwrap } from './load.mjs';

test('DA.6-T1 fromBytes / toBytes round-trip', () => {
  const bytes = Uint8Array.of(0x76, 0xa9, 0x14, 1, 2, 3);
  const s = ScriptOps.fromBytes(bytes);
  assert.deepEqual(Array.from(ScriptOps.toBytes(s)), Array.from(bytes));
});

test('DA.6-T2 fromHex rejects bad hex', () => {
  assert.equal(ScriptOps.fromHex('xyz').ok, false);
});

test('DA.6-T3 toHex lower-case; length correct', () => {
  const hex = txFixture.outputs[0].lockingScriptHex as string;
  const s = unwrap(ScriptOps.fromHex(hex));
  assert.equal(ScriptOps.toHex(s), hex.toLowerCase());
  assert.equal(ScriptOps.length(s), txFixture.outputs[0].lockingScriptLength);
});
