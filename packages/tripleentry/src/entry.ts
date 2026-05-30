// The triple-entry data model: debit side, credit side, and the single shared
// on-chain entry both sides reference (the third entry).
import type { Txid, Hash, Result } from '@vaa/bsv';
import { ok, err } from '@vaa/bsv';
import type { LedgerEntry, AccountingTransaction } from '@vaa/evidence';
import type { TripleEntryError } from './errors.js';
import { unbalancedEntry } from './errors.js';

export interface EntrySide {
  party: string;
  postings: LedgerEntry[];
  sharedEntryRef: { txid: Txid; vout: number };
}

export interface SharedEntry {
  accountingTx: AccountingTransaction;
  fieldTreeRoot: Hash;
  txid: Txid;
}

export interface TripleEntry {
  debitSide: EntrySide;
  creditSide: EntrySide;
  shared: SharedEntry;
}

export interface TripleEntryEvent {
  debitParty: string;
  creditParty: string;
  debitPostings: LedgerEntry[];
  creditPostings: LedgerEntry[];
  sharedTx: AccountingTransaction;
  sharedFieldTreeRoot: Hash;
  sharedTxid: Txid;
  sharedVout: number;
}

export function sumDebit(postings: LedgerEntry[]): bigint {
  return postings.reduce((a, p) => a + p.debit, 0n);
}
export function sumCredit(postings: LedgerEntry[]): bigint {
  return postings.reduce((a, p) => a + p.credit, 0n);
}

export function buildTripleEntry(event: TripleEntryEvent): Result<TripleEntry, TripleEntryError> {
  const d = sumDebit(event.debitPostings);
  const c = sumCredit(event.creditPostings);
  if (d !== c) return err(unbalancedEntry(d, c));
  const ref = { txid: event.sharedTxid, vout: event.sharedVout };
  return ok({
    debitSide: { party: event.debitParty, postings: event.debitPostings, sharedEntryRef: ref },
    creditSide: { party: event.creditParty, postings: event.creditPostings, sharedEntryRef: ref },
    shared: { accountingTx: event.sharedTx, fieldTreeRoot: event.sharedFieldTreeRoot, txid: event.sharedTxid },
  });
}
