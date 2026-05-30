// Reconciliation by construction + verification. Because the third entry is the
// shared, immutable, mutually-referenced record, a debit without its matching
// credit, or a divergence between a side and the shared entry, is detectable.
import type { VerifyResult, HeaderChain } from '@vaa/bsv';
import { TxidOps, verifyOk, verifyFail } from '@vaa/bsv';
import type { AccountingTransaction } from '@vaa/evidence';
import type { TripleEntry, EntrySide } from './entry.js';
import { sumDebit, sumCredit } from './entry.js';
import type { TripleEntryVerifyReason } from './errors.js';

// Read a numericValue field (version byte + 8-byte big-endian) from the shared tx.
function readSharedAmount(tx: AccountingTransaction, tag: string): bigint | undefined {
  const field = tx.fields.find((f) => f.tag === tag);
  if (field === undefined || field.value.length !== 9) return undefined;
  let v = 0n;
  for (let i = 1; i < 9; i++) v = (v << 8n) | BigInt(field.value[i] as number);
  return v;
}

export const SHARED_AMOUNT_TAG = 'event.amount';

export function verifyTripleEntry(te: TripleEntry, headerChain: HeaderChain): VerifyResult<TripleEntryVerifyReason> {
  // (1) the event balances
  const d = sumDebit(te.debitSide.postings);
  const c = sumCredit(te.creditSide.postings);
  if (d !== c) return verifyFail({ kind: 'UnbalancedEntry', debit: d.toString(), credit: c.toString() });

  // (2) both sides reference the same shared on-chain entry
  if (!TxidOps.equals(te.debitSide.sharedEntryRef.txid, te.shared.txid)) return verifyFail({ kind: 'SharedEntryNotReferenced', side: 'debit' });
  if (!TxidOps.equals(te.creditSide.sharedEntryRef.txid, te.shared.txid)) return verifyFail({ kind: 'SharedEntryNotReferenced', side: 'credit' });

  // (3) each side's figures agree with the shared entry's committed amount
  const shared = readSharedAmount(te.shared.accountingTx, SHARED_AMOUNT_TAG);
  if (shared === undefined) return verifyFail({ kind: 'SchemaInvalid', field: SHARED_AMOUNT_TAG });
  if (d !== shared) return verifyFail({ kind: 'SideMismatch', side: 'debit' });
  if (c !== shared) return verifyFail({ kind: 'SideMismatch', side: 'credit' });

  // (4) the shared entry's field-tree root is anchored in the header chain
  if (headerChain.containsMerkleRoot(te.shared.fieldTreeRoot) === undefined) return verifyFail({ kind: 'NotAnchored' });

  return verifyOk();
}

export function detectUnmatched(
  debitSides: EntrySide[],
  creditSides: EntrySide[],
): { unmatchedDebits: EntrySide[]; unmatchedCredits: EntrySide[] } {
  const creditTxids = new Set(creditSides.map((s) => TxidOps.toDisplayHex(s.sharedEntryRef.txid)));
  const debitTxids = new Set(debitSides.map((s) => TxidOps.toDisplayHex(s.sharedEntryRef.txid)));
  return {
    unmatchedDebits: debitSides.filter((s) => !creditTxids.has(TxidOps.toDisplayHex(s.sharedEntryRef.txid))),
    unmatchedCredits: creditSides.filter((s) => !debitTxids.has(TxidOps.toDisplayHex(s.sharedEntryRef.txid))),
  };
}
