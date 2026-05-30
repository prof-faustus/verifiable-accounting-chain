import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serializeEvidence, deserializeEvidence } from '@vaa/evidence';
import type { EvidenceObject } from '@vaa/evidence';

const samples: EvidenceObject[] = [
  { type: 'invoice', id: 'INV1', counterparty: 'ACME', net: 100n, tax: 21n, discount: 1n, gross: 120n },
  { type: 'payment', id: 'PAY1', counterparty: 'ACME', amount: 50n },
  { type: 'ledgerEntry', id: 'L1', account: '4000', debit: 10n, credit: 0n },
  { type: 'reconciliationItem', id: 'R1', bookAmount: 5n, adjustment: -3n },
];

test('DD.1-T1 serialize then deserialize round-trips each type', () => {
  for (const o of samples) {
    const r = deserializeEvidence(serializeEvidence(o));
    assert.equal(r.ok, true);
    if (r.ok) assert.deepEqual(r.value, o);
  }
});

test('DD.1-T2 two invoices differing only in net serialise to different bytes', () => {
  const a = serializeEvidence(samples[0]!);
  const b = serializeEvidence({ ...(samples[0] as { type: 'invoice' } & typeof samples[0]), net: 999n });
  assert.notDeepEqual(Array.from(a), Array.from(b));
});

test('DD.1-T3 wrong version byte -> SerialiseBadVersion{got:2}', () => {
  const bytes = serializeEvidence(samples[0]!);
  bytes[0] = 0x02;
  const r = deserializeEvidence(bytes);
  assert.equal(r.ok, false);
  if (!r.ok && r.error.kind === 'SerialiseBadVersion') assert.equal(r.error.got, 2);
});

test('DD.1-T4 a buffer truncated mid-amount -> DeserialiseTruncated', () => {
  const bytes = serializeEvidence(samples[1]!); // payment: ends with 8-byte amount
  const r = deserializeEvidence(bytes.subarray(0, bytes.length - 3));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.kind, 'DeserialiseTruncated');
});

test('DD.1-T5 serialisation is byte-identical across runs', () => {
  for (const o of samples) {
    assert.deepEqual(Array.from(serializeEvidence(o)), Array.from(serializeEvidence(o)));
  }
});

test('DD.1-T6 a negative adjustment round-trips', () => {
  const o: EvidenceObject = { type: 'reconciliationItem', id: 'R2', bookAmount: 1000n, adjustment: -123456789n };
  const r = deserializeEvidence(serializeEvidence(o));
  assert.equal(r.ok, true);
  if (r.ok && r.value.type === 'reconciliationItem') assert.equal(r.value.adjustment, -123456789n);
});
