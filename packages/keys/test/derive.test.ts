import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pointMulG, pointEq, scalarMod, CURVE_N } from '@vaa/bsv';
import { derivePrivChild, derivePubChild, generatorValue } from '@vaa/keys';

const enc = (s: string) => new TextEncoder().encode(s);

test('K2-T1 public-side derivation matches private-side', () => {
  const parentPriv = scalarMod(123456789012345678901234567890n);
  const parentPub = pointMulG(parentPriv);
  const seg = enc('GL.1000-Cash');
  const childPriv = derivePrivChild(parentPriv, seg);
  assert.equal(childPriv.ok, true);
  if (childPriv.ok) {
    assert.equal(pointEq(derivePubChild(parentPub, seg), pointMulG(childPriv.value)), true);
  }
});

test('K2-T2 distinct segments give distinct children; deterministic', () => {
  const parentPub = pointMulG(scalarMod(7n));
  const a = derivePubChild(parentPub, enc('field:net'));
  const b = derivePubChild(parentPub, enc('field:tax'));
  assert.equal(pointEq(a, b), false);
  assert.equal(pointEq(a, derivePubChild(parentPub, enc('field:net'))), true);
});

test('K2-T3 a zero child returns DerivationOutOfRange', () => {
  // choose parentPriv = n - gv(segment) so child == 0 mod n
  const seg = enc('boundary');
  const gv = generatorValue(seg);
  const parentPriv = scalarMod(CURVE_N - gv);
  const r = derivePrivChild(parentPriv, seg);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.kind, 'DerivationOutOfRange');
});

test('K2-T4 generatorValue is reduced into [0, n)', () => {
  for (const s of ['a', 'bb', 'ccc']) {
    const gv = generatorValue(enc(s));
    assert.ok(gv >= 0n && gv < CURVE_N);
  }
});
