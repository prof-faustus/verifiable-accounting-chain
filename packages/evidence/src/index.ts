// Public surface of @vaa/evidence.
export type { EvidenceError, CheckReason } from './errors.js';
export { schemaInvalid, serialiseBadVersion, deserialiseTruncated, checkMismatch, checkReason } from './errors.js';

export type { InvoiceFields, Payment, LedgerEntry, ReconciliationItem, EvidenceObject } from './schema.js';
export { validate, typeTagOf } from './schema.js';

export { VERSION, serializeEvidence, deserializeEvidence } from './serialise.js';

export type { AccountingField, AccountingKind, AccountingTransaction } from './fieldtree.js';
export {
  numericValue,
  stringValue,
  serialiseField,
  deserialiseField,
  fieldLeaf,
  fieldLeaves,
  fieldTreeRoot,
  expandToFields,
  buildAccountingTx,
  parseAccountingTx,
  discloseField,
  verifyDisclosedField,
} from './fieldtree.js';

export type { BsvContext } from './indexmap.js';
export { indexKeyFor } from './indexmap.js';

export type { ArRollForward, BankReconciliation, VatReturn } from './checks.js';
export {
  sum,
  checkInvoiceTotal,
  checkArRollForward,
  checkDebitCreditEquality,
  checkBankReconciliation,
  checkVat,
} from './checks.js';

export { recordLeaf, populationLeaves, bigInvoiceTransaction } from './population.js';
