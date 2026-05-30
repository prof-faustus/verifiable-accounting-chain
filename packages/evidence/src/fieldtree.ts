// THE FIELD MODEL (core). An accounting transaction is an ordered set of named
// fields; EACH FIELD IS A LEAF in a Merkle tree built over that one accounting
// transaction's fields. The field leaf is the double-SHA256 of the exact on-chain
// FIELD-item body (so on-chain bytes == hashed bytes; Part 5C-P3). The whole
// structure is carried as pushdata in ONE Bitcoin (BSV) transaction across its
// outputs — never OP_RETURN.
import type { Hash, Script, Txid, Point, Result, VerifyResult } from '@vaa/bsv';
import { doubleSha256, concat } from '@vaa/bsv';
import { computeRoot, merkleProof, verifyProof } from '@vaa/merkle';
import type { MerkleProof, MerkleVerifyReason } from '@vaa/merkle';
import type { EvidenceObject } from './schema.js';
import type { EvidenceError } from './errors.js';
import { schemaInvalid } from './errors.js';
import type { ChainItem } from './encoding.js';
import { fieldItemBody, encodeStream, decodeStream, packEnvelopes, unpackEnvelopes } from './encoding.js';

export interface AccountingField {
  tag: string;
  value: Uint8Array;
}

export type AccountingKind = 'invoice' | 'journal' | 'ledgerPosting' | 'reconciliation' | 'statementLines';

export interface AccountingTransaction {
  kind: AccountingKind;
  fields: AccountingField[];
}

const encoder = new TextEncoder();
const VALUE_VERSION = 0x01;

export const KIND_TO_BYTE: Record<AccountingKind, number> = {
  invoice: 1,
  journal: 2,
  ledgerPosting: 3,
  reconciliation: 4,
  statementLines: 5,
};
const BYTE_TO_KIND: Record<number, AccountingKind> = {
  1: 'invoice',
  2: 'journal',
  3: 'ledgerPosting',
  4: 'reconciliation',
  5: 'statementLines',
};

// Canonical value encodings (a leading version byte; numbers are fixed-width
// 8-byte big-endian minor units).
export function numericValue(n: bigint): Uint8Array {
  const out = new Uint8Array(9);
  out[0] = VALUE_VERSION;
  let v = ((n % (1n << 64n)) + (1n << 64n)) % (1n << 64n);
  for (let i = 8; i >= 1; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

export function stringValue(s: string): Uint8Array {
  return concat(Uint8Array.of(VALUE_VERSION), encoder.encode(s));
}

// The field leaf: double-SHA256 of the exact FIELD-item body (leafIndex, tag,
// value). The leafIndex binds each field to its position.
export function fieldLeaf(leafIndex: number, field: AccountingField): Hash {
  return doubleSha256(fieldItemBody(leafIndex, field.tag, field.value));
}

export function fieldLeaves(tx: AccountingTransaction): Hash[] {
  return tx.fields.map((f, i) => fieldLeaf(i, f));
}

export function fieldTreeRoot(tx: AccountingTransaction): Result<Hash, EvidenceError> {
  const root = computeRoot(fieldLeaves(tx));
  if (!root.ok) return { ok: false, error: schemaInvalid('fields', 'an accounting transaction needs at least one field') };
  return { ok: true, value: root.value };
}

// Map a typed evidence object to its standard tagged field set.
export function expandToFields(obj: EvidenceObject): AccountingField[] {
  switch (obj.type) {
    case 'invoice':
      return [
        { tag: 'invoice.id', value: stringValue(obj.id) },
        { tag: 'invoice.counterparty', value: stringValue(obj.counterparty) },
        { tag: 'invoice.net', value: numericValue(obj.net) },
        { tag: 'invoice.tax', value: numericValue(obj.tax) },
        { tag: 'invoice.discount', value: numericValue(obj.discount) },
        { tag: 'invoice.gross', value: numericValue(obj.gross) },
      ];
    case 'payment':
      return [
        { tag: 'payment.id', value: stringValue(obj.id) },
        { tag: 'payment.counterparty', value: stringValue(obj.counterparty) },
        { tag: 'payment.amount', value: numericValue(obj.amount) },
      ];
    case 'ledgerEntry':
      return [
        { tag: 'ledger.id', value: stringValue(obj.id) },
        { tag: 'ledger.account', value: stringValue(obj.account) },
        { tag: 'ledger.debit', value: numericValue(obj.debit) },
        { tag: 'ledger.credit', value: numericValue(obj.credit) },
      ];
    case 'reconciliationItem':
      return [
        { tag: 'recon.id', value: stringValue(obj.id) },
        { tag: 'recon.bookAmount', value: numericValue(obj.bookAmount) },
        { tag: 'recon.adjustment', value: numericValue(obj.adjustment) },
      ];
  }
}

export interface ChainLinkData {
  index: number;
  prevTxid: Txid;
  prevFieldRoot: Hash;
  prevOutpointVout: number;
  linkPub: Point;
  signature: Uint8Array;
}

// Build the HEADER + FIELD items (plus any extra TLV items) and pack them into
// OP_FALSE OP_IF envelopes across the outputs of ONE Bitcoin (BSV) transaction.
export function buildAccountingTx(
  tx: AccountingTransaction,
  extras: ChainItem[] = [],
): Result<{ lockingScripts: Script[]; fieldTreeRoot: Hash; items: ChainItem[] }, EvidenceError> {
  const root = fieldTreeRoot(tx);
  if (!root.ok) return { ok: false, error: root.error };

  const items: ChainItem[] = [
    { type: 'header', kind: KIND_TO_BYTE[tx.kind], fieldCount: tx.fields.length, fieldTreeRoot: root.value, rootPartScheme: 0, partCount: 0 },
    ...tx.fields.map((f, i): ChainItem => ({ type: 'field', leafIndex: i, tag: f.tag, value: f.value })),
    ...extras,
  ];
  const scripts = packEnvelopes(encodeStream(items));
  if (!scripts.ok) return { ok: false, error: scripts.error };
  return { ok: true, value: { lockingScripts: scripts.value, fieldTreeRoot: root.value, items } };
}

// Build the accounting transaction as the next chain link: append a CHAIN-LINK
// item so the link travels in the transaction's script.
export function buildChainedAccountingTx(
  tx: AccountingTransaction,
  link: ChainLinkData,
  extras: ChainItem[] = [],
): Result<{ lockingScripts: Script[]; fieldTreeRoot: Hash; items: ChainItem[] }, EvidenceError> {
  const chainItem: ChainItem = {
    type: 'chainLink',
    index: link.index,
    prevTxid: link.prevTxid,
    prevFieldRoot: link.prevFieldRoot,
    prevOutpointVout: link.prevOutpointVout,
    linkPub: link.linkPub,
    signature: link.signature,
  };
  return buildAccountingTx(tx, [chainItem, ...extras]);
}

export function parseAccountingTx(scripts: Script[]): Result<{ tx: AccountingTransaction; items: ChainItem[] }, EvidenceError> {
  if (scripts.length === 0) return { ok: false, error: schemaInvalid('scripts', 'no scripts') };
  const stream = unpackEnvelopes(scripts);
  if (!stream.ok) return { ok: false, error: stream.error };
  const decoded = decodeStream(stream.value);
  if (!decoded.ok) return { ok: false, error: decoded.error };
  const items = decoded.value;
  const header = items.find((i) => i.type === 'header');
  if (header === undefined || header.type !== 'header') return { ok: false, error: schemaInvalid('header', 'missing HEADER item') };
  const kind = BYTE_TO_KIND[header.kind];
  if (kind === undefined) return { ok: false, error: schemaInvalid('kind', `unknown kind byte ${header.kind}`) };
  const fields = items
    .filter((i): i is Extract<ChainItem, { type: 'field' }> => i.type === 'field')
    .sort((a, b) => a.leafIndex - b.leafIndex)
    .map((i) => ({ tag: i.tag, value: i.value }));
  return { ok: true, value: { tx: { kind, fields }, items } };
}

// PER-FIELD SELECTIVE DISCLOSURE.
export function discloseField(
  tx: AccountingTransaction,
  fieldIndex: number,
): Result<{ field: AccountingField; leafIndex: number; proof: MerkleProof; root: Hash }, EvidenceError> {
  const field = tx.fields[fieldIndex];
  if (field === undefined) return { ok: false, error: schemaInvalid('fieldIndex', 'out of range') };
  const leaves = fieldLeaves(tx);
  const proof = merkleProof(leaves, fieldIndex);
  if (!proof.ok) return { ok: false, error: schemaInvalid('fieldIndex', 'out of range') };
  const root = computeRoot(leaves);
  if (!root.ok) return { ok: false, error: schemaInvalid('fields', 'empty') };
  return { ok: true, value: { field, leafIndex: fieldIndex, proof: proof.value, root: root.value } };
}

export function verifyDisclosedField(leafIndex: number, field: AccountingField, proof: MerkleProof, root: Hash): VerifyResult<MerkleVerifyReason> {
  return verifyProof(fieldLeaf(leafIndex, field), proof, root);
}
