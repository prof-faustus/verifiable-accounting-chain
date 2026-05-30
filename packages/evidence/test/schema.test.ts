import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '@vaa/evidence';
import type { EvidenceObject } from '@vaa/evidence';

const invoice: EvidenceObject = { type: 'invoice', id: 'INV1', counterparty: 'ACME', net: 100n, tax: 21n, discount: 1n, gross: 120n };
const payment: EvidenceObject = { type: 'payment', id: 'PAY1', counterparty: 'ACME', amount: 50n };
const ledger: EvidenceObject = { type: 'ledgerEntry', id: 'L1', account: '4000', debit: 10n, credit: 0n };
const recon: EvidenceObject = { type: 'reconciliationItem', id: 'R1', bookAmount: 5n, adjustment: -3n };

test('D.2 T-schema-1 each type validates a correct instance', () => {
  for (const o of [invoice, payment, ledger, recon]) assert.equal(validate(o).ok, true);
});

test('D.2 T-schema-2 rejects empty id, a negative non-negative field, a non-bigint amount', () => {
  assert.equal(validate({ ...invoice, id: '' }).ok, false);
  assert.equal(validate({ ...invoice, net: -1n }).ok, false);
  assert.equal(validate({ ...payment, amount: -1n }).ok, false);
  assert.equal(validate({ ...recon, bookAmount: -1n }).ok, false);
  // adjustment may be negative
  assert.equal(validate({ ...recon, adjustment: -100n }).ok, true);
  // a non-bigint amount (would be a compile-time error; checked at runtime too)
  assert.equal(validate({ ...payment, amount: 5 as unknown as bigint }).ok, false);
});
