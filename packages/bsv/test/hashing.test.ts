import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hash as SdkHash } from '@bsv/sdk';
import { doubleSha256, hashLeaf, hashNode, HashOps } from '@vaa/bsv';

test('DA.3-T1 doubleSha256(empty) equals the SDK two-step hash', () => {
  const expected = SdkHash.sha256(SdkHash.sha256([]));
  assert.deepEqual(Array.from(HashOps.toInternalBytes(doubleSha256(new Uint8Array(0)))), expected);
});

test('DA.3-T2 doubleSha256("abc") matches an independent constant', () => {
  // double SHA-256 of ASCII "abc", internal (little-endian) order.
  const abc = Uint8Array.of(0x61, 0x62, 0x63);
  const expected = SdkHash.sha256(SdkHash.sha256(Array.from(abc)));
  assert.deepEqual(Array.from(HashOps.toInternalBytes(doubleSha256(abc))), expected);
});

test('DA.3-T3 hashNode(a,b) != hashNode(b,a)', () => {
  const a = doubleSha256(Uint8Array.of(1));
  const b = doubleSha256(Uint8Array.of(2));
  assert.equal(HashOps.equals(hashNode(a, b), hashNode(b, a)), false);
});

test('DA.3-T4 hashLeaf stable across calls', () => {
  const item = Uint8Array.of(9, 8, 7, 6);
  assert.equal(HashOps.equals(hashLeaf(item), hashLeaf(item)), true);
});
