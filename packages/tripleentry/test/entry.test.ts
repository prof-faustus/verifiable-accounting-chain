import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TxidOps, HashOps } from '@vaa/bsv';
import { buildTripleEntry } from '@vaa/tripleentry';
import { ledgerEntry, txidAt } from './util.mjs';
import { numericValue } from '@vaa/evidence';

test('TE2-T1 a balanced event builds a triple entry; both sides reference the shared outpoint', () => {
  const sharedTxid = txidAt(5);
  const r = buildTripleEntry({
    debitParty: 'Buyer',
    creditParty: 'Seller',
    debitPostings: [ledgerEntry('d', '1000', 100n, 0n)],
    creditPostings: [ledgerEntry('c', '4000', 0n, 100n)],
    sharedTx: { kind: 'journal', fields: [{ tag: 'event.amount', value: numericValue(100n) }] },
    sharedFieldTreeRoot: HashOps.zero(),
    sharedTxid,
    sharedVout: 1,
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(TxidOps.equals(r.value.debitSide.sharedEntryRef.txid, sharedTxid), true);
    assert.equal(TxidOps.equals(r.value.creditSide.sharedEntryRef.txid, sharedTxid), true);
    assert.equal(r.value.debitSide.sharedEntryRef.vout, 1);
  }
});

test('TE2-T2 an unbalanced event -> UnbalancedEntry with the two totals', () => {
  const r = buildTripleEntry({
    debitParty: 'Buyer',
    creditParty: 'Seller',
    debitPostings: [ledgerEntry('d', '1000', 100n, 0n)],
    creditPostings: [ledgerEntry('c', '4000', 0n, 90n)],
    sharedTx: { kind: 'journal', fields: [{ tag: 'event.amount', value: numericValue(100n) }] },
    sharedFieldTreeRoot: HashOps.zero(),
    sharedTxid: txidAt(5),
    sharedVout: 0,
  });
  assert.equal(r.ok, false);
  if (!r.ok && r.error.kind === 'UnbalancedEntry') {
    assert.equal(r.error.debit, '100');
    assert.equal(r.error.credit, '90');
  }
});
