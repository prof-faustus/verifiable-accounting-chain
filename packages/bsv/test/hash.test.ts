import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HashOps } from '@vaa/bsv';
import { unwrap } from './load.mjs';

const sampleInternal = new Uint8Array(32).map((_, i) => (i * 9 + 1) & 0xff);

test('DA.2-T1 internal <-> display round-trip', () => {
  const h = unwrap(HashOps.fromInternalBytes(sampleInternal));
  const display = HashOps.toDisplayHex(h);
  const back = unwrap(HashOps.fromDisplayHex(display));
  assert.deepEqual(Array.from(HashOps.toInternalBytes(back)), Array.from(sampleInternal));
});

test('DA.2-T2 fromInternalBytes rejects wrong length', () => {
  const r31 = HashOps.fromInternalBytes(new Uint8Array(31));
  const r33 = HashOps.fromInternalBytes(new Uint8Array(33));
  assert.equal(r31.ok, false);
  assert.equal(r33.ok, false);
  if (!r31.ok && r31.error.kind === 'HashBadLength') assert.equal(r31.error.got, 31);
  if (!r33.ok && r33.error.kind === 'HashBadLength') assert.equal(r33.error.got, 33);
});

test('DA.2-T3 fromDisplayHex rejects length and charset', () => {
  assert.equal(HashOps.fromDisplayHex('a'.repeat(63)).ok, false);
  assert.equal(HashOps.fromDisplayHex('a'.repeat(65)).ok, false);
  const r = HashOps.fromDisplayHex('z'.repeat(64));
  assert.equal(r.ok, false);
  if (!r.ok && r.error.kind === 'HashBadHex') assert.equal(r.error.reason, 'charset');
});

test('DA.2-T4 equals reflexive, symmetric, differs on a byte change', () => {
  const a = unwrap(HashOps.fromInternalBytes(sampleInternal));
  const b = unwrap(HashOps.fromInternalBytes(sampleInternal));
  assert.equal(HashOps.equals(a, a), true);
  assert.equal(HashOps.equals(a, b), true);
  assert.equal(HashOps.equals(b, a), true);
  const altered = Uint8Array.from(sampleInternal);
  altered[5] = (altered[5]! ^ 0xff) & 0xff;
  const c = unwrap(HashOps.fromInternalBytes(altered));
  assert.equal(HashOps.equals(a, c), false);
});

test('DA.2-T5 toDisplayHex is 64 chars lower-case', () => {
  const h = unwrap(HashOps.fromInternalBytes(sampleInternal));
  const d = HashOps.toDisplayHex(h);
  assert.equal(d.length, 64);
  assert.equal(d, d.toLowerCase());
});

test('zero() is all-zero 32 bytes', () => {
  assert.deepEqual(Array.from(HashOps.toInternalBytes(HashOps.zero())), new Array(32).fill(0));
});
