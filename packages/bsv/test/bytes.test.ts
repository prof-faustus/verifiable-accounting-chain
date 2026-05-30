import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  readU32LE,
  writeU32LE,
  readVarInt,
  writeVarInt,
  reverseBytes,
  concat,
  toHexLower,
  fromHex,
} from '@vaa/bsv';

test('DA.1-T1..T4 readU32LE known values', () => {
  assert.equal((readU32LE(Uint8Array.of(0, 0, 0, 0), 0) as { ok: true; value: number }).value, 0);
  assert.equal((readU32LE(Uint8Array.of(1, 0, 0, 0), 0) as { ok: true; value: number }).value, 1);
  assert.equal((readU32LE(Uint8Array.of(0xff, 0xff, 0xff, 0x7f), 0) as { ok: true; value: number }).value, 0x7fffffff);
  assert.equal((readU32LE(Uint8Array.of(0xff, 0xff, 0xff, 0xff), 0) as { ok: true; value: number }).value, 0xffffffff);
});

test('DA.1-T5 readU32LE out of range', () => {
  const r = readU32LE(Uint8Array.of(1, 2), 1);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.kind, 'BytesOutOfRange');
});

test('writeU32LE round-trips with readU32LE', () => {
  for (const v of [0, 1, 0x7fffffff, 0xffffffff]) {
    const buf = new Uint8Array(4);
    writeU32LE(v, buf, 0);
    assert.equal((readU32LE(buf, 0) as { ok: true; value: number }).value, v >>> 0);
  }
});

test('DA.1-T6..T10 readVarInt prefixes', () => {
  const v = (b: number[]) => readVarInt(Uint8Array.from(b), 0);
  assert.deepEqual((v([0x00]) as { ok: true; value: { value: bigint; nextOffset: number } }).value, { value: 0n, nextOffset: 1 });
  assert.deepEqual((v([0xfc]) as { ok: true; value: { value: bigint; nextOffset: number } }).value, { value: 252n, nextOffset: 1 });
  assert.deepEqual((v([0xfd, 0xfd, 0x00]) as { ok: true; value: { value: bigint; nextOffset: number } }).value, { value: 253n, nextOffset: 3 });
  assert.deepEqual((v([0xfe, 0, 0, 1, 0]) as { ok: true; value: { value: bigint; nextOffset: number } }).value, { value: 65536n, nextOffset: 5 });
  assert.deepEqual((v([0xff, 0, 0, 0, 0, 1, 0, 0, 0]) as { ok: true; value: { value: bigint; nextOffset: number } }).value, { value: 4294967296n, nextOffset: 9 });
});

test('DA.1-T11 readVarInt truncated at each prefix', () => {
  for (const b of [[0xfd], [0xfe, 0, 0], [0xff, 0]]) {
    const r = readVarInt(Uint8Array.from(b), 0);
    assert.equal(r.ok, false);
  }
});

test('DA.1-T12 writeVarInt then readVarInt identity', () => {
  for (const value of [0n, 252n, 253n, 65535n, 65536n, 4294967295n, 4294967296n]) {
    const enc = writeVarInt(value);
    const dec = readVarInt(enc, 0);
    assert.equal(dec.ok, true);
    if (dec.ok) {
      assert.equal(dec.value.value, value);
      assert.equal(dec.value.nextOffset, enc.length);
    }
  }
});

test('writeVarInt throws on negative (programmer misuse)', () => {
  assert.throws(() => writeVarInt(-1n));
});

test('DA.1-T13 reverseBytes', () => {
  assert.deepEqual(Array.from(reverseBytes(Uint8Array.of(1, 2, 3, 4))), [4, 3, 2, 1]);
  const b = new Uint8Array(32).map((_, i) => i);
  assert.deepEqual(Array.from(reverseBytes(reverseBytes(b))), Array.from(b));
});

test('concat joins parts', () => {
  assert.deepEqual(Array.from(concat(Uint8Array.of(1), Uint8Array.of(2, 3))), [1, 2, 3]);
});

test('DA.1-T14 fromHex / toHexLower', () => {
  assert.equal(fromHex('abc').ok, false); // odd length
  assert.equal(fromHex('zz').ok, false); // charset
  const b = new Uint8Array(32).map((_, i) => (i * 7) & 0xff);
  const hex = toHexLower(b);
  assert.equal(hex, hex.toLowerCase());
  assert.deepEqual(Array.from((fromHex(hex) as { ok: true; value: Uint8Array }).value), Array.from(b));
});
