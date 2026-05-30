// Public surface of @vaa/evidence.
export type { EvidenceError, CheckReason } from './errors.js';
export { schemaInvalid, serialiseBadVersion, deserialiseTruncated, checkMismatch, checkReason } from './errors.js';

export type { InvoiceFields, Payment, LedgerEntry, ReconciliationItem, EvidenceObject } from './schema.js';
export { validate, typeTagOf } from './schema.js';

export { VERSION, serializeEvidence, deserializeEvidence } from './serialise.js';

export type { ChainItem } from './encoding.js';
export {
  ITEM_HEADER,
  ITEM_FIELD,
  ITEM_ROOT_PART,
  ITEM_ASSIST,
  ITEM_CHAIN_LINK,
  ITEM_MAPPING_ROOT,
  ITEM_TRIPLE_REF,
  ITEM_PKI_ATTEST,
  EVIDENCE_ENVELOPE_CHUNK,
  fieldItemBody,
  encodeItem,
  encodeStream,
  decodeStream,
  packEnvelopes,
  unpackEnvelopes,
} from './encoding.js';

export type { AccountingField, AccountingKind, AccountingTransaction, ChainLinkData } from './fieldtree.js';
export {
  KIND_TO_BYTE,
  numericValue,
  stringValue,
  fieldLeaf,
  fieldLeaves,
  fieldTreeRoot,
  expandToFields,
  buildAccountingTx,
  buildChainedAccountingTx,
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
