// Accounting checks by RECOMPUTATION over disclosed records (not hidden-value
// cryptography). All arithmetic is bigint and overflow-safe by construction.
import type { VerifyResult } from '@vaa/bsv';
import { verifyOk, verifyFail } from '@vaa/bsv';
import type { InvoiceFields, LedgerEntry } from './schema.js';
import type { CheckReason } from './errors.js';
import { checkReason } from './errors.js';

export function sum(xs: bigint[]): bigint {
  let acc = 0n;
  for (const x of xs) acc += x;
  return acc;
}

export function checkInvoiceTotal(inv: InvoiceFields): VerifyResult<CheckReason> {
  const computed = inv.net + inv.tax - inv.discount;
  if (inv.gross === computed) return verifyOk();
  return verifyFail(checkReason('invoiceTotal', computed, inv.gross));
}

export interface ArRollForward {
  open: bigint;
  invoices: bigint[];
  receipts: bigint[];
  creditNotes: bigint[];
  writeOffs: bigint[];
  close: bigint;
}

export function checkArRollForward(p: ArRollForward): VerifyResult<CheckReason> {
  const computed = p.open + sum(p.invoices) - sum(p.receipts) - sum(p.creditNotes) - sum(p.writeOffs);
  if (p.close === computed) return verifyOk();
  return verifyFail(checkReason('arRollForward', computed, p.close));
}

export function checkDebitCreditEquality(entries: LedgerEntry[]): VerifyResult<CheckReason> {
  const debit = sum(entries.map((e) => e.debit));
  const credit = sum(entries.map((e) => e.credit));
  if (debit === credit) return verifyOk();
  return verifyFail(checkReason('debitCredit', credit, debit));
}

export interface BankReconciliation {
  bookCash: bigint;
  reconcilingItems: bigint[];
  bankBalance: bigint;
}

export function checkBankReconciliation(p: BankReconciliation): VerifyResult<CheckReason> {
  const computed = p.bookCash + sum(p.reconcilingItems);
  if (p.bankBalance === computed) return verifyOk();
  return verifyFail(checkReason('bankRec', computed, p.bankBalance));
}

export interface VatReturn {
  outputTax: bigint;
  inputTax: bigint;
  payable: bigint;
}

export function checkVat(p: VatReturn): VerifyResult<CheckReason> {
  const computed = p.outputTax - p.inputTax;
  if (p.payable === computed) return verifyOk();
  return verifyFail(checkReason('vat', computed, p.payable));
}
