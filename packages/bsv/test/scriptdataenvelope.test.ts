import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildScriptDataEnvelope,
  recognise,
  containsOpReturn,
  MAX_ENVELOPE_PAYLOAD,
  ScriptOps,
} from '@vaa/bsv';
import { unwrap } from './load.mjs';

test('DA.10 T-env-1 build then recognise round-trips payloads', () => {
  for (const payload of [new Uint8Array(32).map((_, i) => i), Uint8Array.of(1, 2, 3), new Uint8Array(300).fill(7)]) {
    const env = unwrap(buildScriptDataEnvelope(payload));
    const back = unwrap(recognise(env.lockingScript));
    assert.deepEqual(Array.from(back), Array.from(payload));
  }
});

test('T-env-2 recognise returns EnvelopeNotRecognised for an ordinary script', () => {
  const p2pkh = unwrap(ScriptOps.fromHex('76a914233eec87694359369ad72edf42d737a156c6412888ac'));
  const r = recognise(p2pkh);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.kind, 'EnvelopeNotRecognised');
});

test('T-env-3 buildScriptDataEnvelope rejects an oversize payload', () => {
  const r = buildScriptDataEnvelope(new Uint8Array(MAX_ENVELOPE_PAYLOAD + 1));
  assert.equal(r.ok, false);
  if (!r.ok && r.error.kind === 'EnvelopeOversize') {
    assert.equal(r.error.maxBytes, MAX_ENVELOPE_PAYLOAD);
    assert.equal(r.error.gotBytes, MAX_ENVELOPE_PAYLOAD + 1);
  }
});

test('T-env-4 no produced script contains the OP_RETURN opcode', () => {
  // payload deliberately contains the byte 0x6a inside the pushdata.
  const payload = Uint8Array.of(0x6a, 0x6a, 0x6a, 1, 2, 3);
  const env = unwrap(buildScriptDataEnvelope(payload));
  assert.equal(containsOpReturn(env.lockingScript), false);
  // and it still round-trips
  assert.deepEqual(Array.from(unwrap(recognise(env.lockingScript))), Array.from(payload));
});
