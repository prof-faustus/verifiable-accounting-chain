import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Curve, BigNumber } from '@bsv/sdk';
import {
  CURVE_N,
  CURVE_G,
  scalarMod,
  scalarAdd,
  reduceScalar,
  pointMul,
  pointMulG,
  pointAdd,
  pointEq,
  encodePoint,
  pointToHex,
  decodePoint,
} from '@vaa/bsv';

const sdk = new Curve();

test('DK.8 G and n match the BSV curve', () => {
  assert.equal(CURVE_N.toString(), sdk.n.toString());
  assert.equal(pointToHex(CURVE_G), sdk.g.encode(true, 'hex'));
});

test('DK.8 pointMul / pointMulG / pointAdd agree with the SDK on known vectors', () => {
  for (const k of [1n, 2n, 5n, 12345678901234567890n]) {
    const expected = sdk.g.mul(new BigNumber(k.toString())).encode(true, 'hex');
    assert.equal(pointToHex(pointMulG(k)), expected);
    assert.equal(pointToHex(pointMul(CURVE_G, k)), expected);
  }
  // additive homomorphism: 5G + 7G == 12G
  assert.equal(pointEq(pointAdd(pointMulG(5n), pointMulG(7n)), pointMulG(12n)), true);
  // G + G == 2G
  assert.equal(pointEq(pointAdd(CURVE_G, CURVE_G), pointMulG(2n)), true);
});

test('DK.8 scalar reduction at boundaries 0, n-1, n, n+1', () => {
  assert.equal(scalarMod(0n), 0n);
  assert.equal(scalarMod(CURVE_N - 1n), CURVE_N - 1n);
  assert.equal(scalarMod(CURVE_N), 0n);
  assert.equal(scalarMod(CURVE_N + 1n), 1n);
  assert.equal(scalarAdd(CURVE_N - 1n, 2n), 1n);
});

test('DK.8 reduceScalar interprets big-endian bytes mod n, deterministic', () => {
  const bytes = new Uint8Array(32).fill(0xff);
  const r = reduceScalar(bytes);
  assert.equal(r, reduceScalar(bytes));
  assert.ok(r >= 0n && r < CURVE_N);
});

test('DK.8 encode/decode point round-trips, decode rejects bad input', () => {
  const p = pointMulG(98765n);
  const enc = encodePoint(p);
  assert.equal(enc.length, 33);
  const back = decodePoint(enc);
  assert.equal(back.ok, true);
  if (back.ok) assert.equal(pointEq(back.value, p), true);
  assert.equal(decodePoint(new Uint8Array(10)).ok, false);
  assert.equal(decodePoint(new Uint8Array(33)).ok, false); // all-zero is not a valid point
});
