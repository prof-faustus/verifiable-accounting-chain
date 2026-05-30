import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseHeader,
  serializeHeader,
  headerHash,
  targetFromBits,
  meetsTarget,
  HashOps,
} from '@vaa/bsv';
import { headersFixture, buildHeader } from './load.mjs';

const rec181 = headersFixture.headers[2];

test('DA.4-T1 parse a genuine 80-byte header; serialize round-trips', async () => {
  const h = await buildHeader(rec181);
  const raw = serializeHeader(h);
  assert.equal(raw.length, 80);
  const parsed = parseHeader(raw);
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.value.version, rec181.version);
    assert.equal(parsed.value.time, rec181.time);
    assert.equal(parsed.value.bits, rec181.bits);
    assert.equal(parsed.value.nonce, rec181.nonce);
    assert.deepEqual(Array.from(serializeHeader(parsed.value)), Array.from(raw));
  }
});

test('DA.4-T2 headerHash equals the published block hash', async () => {
  const h = await buildHeader(rec181);
  assert.equal(HashOps.toDisplayHex(headerHash(h)), rec181.hash);
});

test('DA.4-T3 targetFromBits on a known compact target', () => {
  assert.equal(targetFromBits(486604799), 0xffffn << 208n);
});

test('DA.4-T4 meetsTarget true for genuine; false for a hard target', async () => {
  const h = await buildHeader(rec181);
  assert.equal(meetsTarget(h), true);
  const hard = { ...h, bits: 0x03000001 }; // target == 1; any real hash exceeds it
  assert.equal(meetsTarget(hard), false);
});

test('DA.4-T5 parseHeader rejects 79 and 81 bytes', () => {
  const r79 = parseHeader(new Uint8Array(79));
  const r81 = parseHeader(new Uint8Array(81));
  assert.equal(r79.ok, false);
  assert.equal(r81.ok, false);
  if (!r79.ok && r79.error.kind === 'HeaderBadLength') assert.equal(r79.error.got, 79);
  if (!r81.ok && r81.error.kind === 'HeaderBadLength') assert.equal(r81.error.got, 81);
});
