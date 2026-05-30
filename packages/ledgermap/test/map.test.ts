import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pointMulG, pointEq } from '@vaa/bsv';
import { derivePathPriv } from '@vaa/keys';
import { fieldKey, mapField, verifyFieldUnderRoot } from '@vaa/ledgermap';
import { sampleMap } from './util.mjs';

test('LM3-T1 fieldKey deterministic, distinct, equals private-side key·G', () => {
  const { map, rootPriv } = sampleMap();
  const k1 = fieldKey(map, ['GL', '4000-Sales'], 'net');
  const k2 = fieldKey(map, ['GL', '4000-Sales'], 'tax');
  assert.equal(k1.ok && k2.ok, true);
  if (k1.ok && k2.ok) {
    assert.equal(pointEq(k1.value, k2.value), false);
    const priv = derivePathPriv(rootPriv, ['GL', '4000-Sales', 'field:net']);
    assert.equal(priv.ok, true);
    if (priv.ok) assert.equal(pointEq(k1.value, pointMulG(priv.value)), true);
  }
});

test('LM3-T2 mapField returns path/key; FieldNotMapped for an unmapped tag', () => {
  const { map } = sampleMap();
  const ok = mapField(map, ['GL', '1000-Cash'], 'balance');
  assert.equal(ok.ok, true);
  if (ok.ok) assert.deepEqual(ok.value.path, ['GL', '1000-Cash', 'field:balance']);
  const bad = mapField(map, ['GL', '1000-Cash'], 'nonexistent');
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.error.kind, 'FieldNotMapped');
});

test('LM3-T3 verifyFieldUnderRoot accepts genuine, rejects off-by-one path', () => {
  const { map } = sampleMap();
  const k = fieldKey(map, ['GL', '4000-Sales'], 'net');
  assert.equal(k.ok, true);
  if (k.ok) {
    assert.equal(verifyFieldUnderRoot(map, ['GL', '4000-Sales'], 'net', k.value).ok, true);
    assert.equal(verifyFieldUnderRoot(map, ['GL', '4000-Sales'], 'tax', k.value).ok, false);
    assert.equal(verifyFieldUnderRoot(map, ['GL', '1000-Cash'], 'net', k.value).ok, false);
  }
});
