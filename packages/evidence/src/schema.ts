// Accounting object types, all amounts in bigint minor units.
import type { Result } from '@vaa/bsv';
import { ok, err } from '@vaa/bsv';
import type { EvidenceError } from './errors.js';
import { schemaInvalid } from './errors.js';

export interface InvoiceFields {
  type: 'invoice';
  id: string;
  counterparty: string;
  net: bigint;
  tax: bigint;
  discount: bigint;
  gross: bigint;
}

export interface Payment {
  type: 'payment';
  id: string;
  counterparty: string;
  amount: bigint;
}

export interface LedgerEntry {
  type: 'ledgerEntry';
  id: string;
  account: string;
  debit: bigint;
  credit: bigint;
}

export interface ReconciliationItem {
  type: 'reconciliationItem';
  id: string;
  bookAmount: bigint;
  adjustment: bigint;
}

export type EvidenceObject = InvoiceFields | Payment | LedgerEntry | ReconciliationItem;

function requireNonNegative(field: string, value: bigint): EvidenceError | undefined {
  if (typeof value !== 'bigint') return schemaInvalid(field, 'amount must be a bigint');
  if (value < 0n) return schemaInvalid(field, 'must be non-negative');
  return undefined;
}

export function validate(obj: EvidenceObject): Result<void, EvidenceError> {
  if (typeof obj.id !== 'string' || obj.id.length === 0) return err(schemaInvalid('id', 'must be a non-empty string'));
  let bad: EvidenceError | undefined;
  switch (obj.type) {
    case 'invoice':
      bad =
        requireNonNegative('net', obj.net) ??
        requireNonNegative('tax', obj.tax) ??
        requireNonNegative('discount', obj.discount) ??
        requireNonNegative('gross', obj.gross);
      break;
    case 'payment':
      bad = requireNonNegative('amount', obj.amount);
      break;
    case 'ledgerEntry':
      bad = requireNonNegative('debit', obj.debit) ?? requireNonNegative('credit', obj.credit);
      break;
    case 'reconciliationItem':
      // adjustment may be negative; bookAmount must be non-negative.
      bad = requireNonNegative('bookAmount', obj.bookAmount);
      if (bad === undefined && typeof obj.adjustment !== 'bigint') bad = schemaInvalid('adjustment', 'amount must be a bigint');
      break;
  }
  if (bad !== undefined) return err(bad);
  return ok(undefined);
}

export function typeTagOf(obj: EvidenceObject): number {
  switch (obj.type) {
    case 'invoice':
      return 0x01;
    case 'payment':
      return 0x02;
    case 'ledgerEntry':
      return 0x03;
    case 'reconciliationItem':
      return 0x04;
  }
}
