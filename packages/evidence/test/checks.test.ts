import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkInvoiceTotal,
  checkArRollForward,
  checkDebitCreditEquality,
  checkBankReconciliation,
  checkVat,
} from '@vaa/evidence';
import type { InvoiceFields, LedgerEntry } from '@vaa/evidence';

const inv = (gross: bigint): InvoiceFields => ({ type: 'invoice', id: 'I', counterparty: 'C', net: 100n, tax: 21n, discount: 1n, gross });

test('DD.2-T1 checkInvoiceTotal ok and not-ok with computed/stated', () => {
  assert.equal(checkInvoiceTotal(inv(120n)).ok, true);
  const r = checkInvoiceTotal(inv(119n));
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.reason.check, 'invoiceTotal');
    assert.equal(r.reason.computed, '120');
    assert.equal(r.reason.stated, '119');
  }
});

test('DD.2-T2 checkArRollForward ok; not-ok with reason when an invoice is dropped', () => {
  const base = { open: 100n, invoices: [50n, 30n], receipts: [20n], creditNotes: [10n], writeOffs: [5n] };
  const close = 100n + 80n - 20n - 10n - 5n;
  assert.equal(checkArRollForward({ ...base, close }).ok, true);
  const r = checkArRollForward({ ...base, invoices: [50n], close });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason.check, 'arRollForward');
});

test('DD.2-T3 checkDebitCreditEquality ok / not-ok', () => {
  const entries: LedgerEntry[] = [
    { type: 'ledgerEntry', id: 'a', account: '1', debit: 100n, credit: 0n },
    { type: 'ledgerEntry', id: 'b', account: '2', debit: 0n, credit: 100n },
  ];
  assert.equal(checkDebitCreditEquality(entries).ok, true);
  entries.push({ type: 'ledgerEntry', id: 'c', account: '3', debit: 1n, credit: 0n });
  assert.equal(checkDebitCreditEquality(entries).ok, false);
});

test('DD.2-T4 checkBankReconciliation ok / not-ok', () => {
  assert.equal(checkBankReconciliation({ bookCash: 500n, reconcilingItems: [20n, -5n], bankBalance: 515n }).ok, true);
  assert.equal(checkBankReconciliation({ bookCash: 500n, reconcilingItems: [20n], bankBalance: 515n }).ok, false);
});

test('DD.2-T5 checkVat ok / not-ok', () => {
  assert.equal(checkVat({ outputTax: 200n, inputTax: 80n, payable: 120n }).ok, true);
  assert.equal(checkVat({ outputTax: 200n, inputTax: 80n, payable: 121n }).ok, false);
});

test('DD.2-T6 all checks correct with values > 2^53 (bigint, no float overflow)', () => {
  const big = 10n ** 30n;
  assert.equal(checkInvoiceTotal({ type: 'invoice', id: 'I', counterparty: 'C', net: big, tax: big, discount: 0n, gross: 2n * big }).ok, true);
  assert.equal(checkVat({ outputTax: 3n * big, inputTax: big, payable: 2n * big }).ok, true);
  assert.equal(checkArRollForward({ open: big, invoices: [big], receipts: [], creditNotes: [], writeOffs: [], close: 2n * big }).ok, true);
});
