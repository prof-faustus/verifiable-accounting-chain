// THE FIELD MODEL (core). An accounting transaction is an ordered set of named
// fields; EACH FIELD IS A LEAF in a Merkle tree built over that one accounting
// transaction's fields (intra-transaction). The root commits the whole field set
// and is carried as pushdata in ONE Bitcoin (BSV) transaction (never OP_RETURN);
// the root may be held in parts across the transaction's scripts.
import type { Hash, Script, Result, VerifyResult } from '@vaa/bsv';
import {
  hashLeaf,
  HashOps,
  concat,
  writeVarInt,
  readVarInt,
  buildScriptDataEnvelope,
  recognise,
} from '@vaa/bsv';
import { computeRoot, merkleProof, verifyProof } from '@vaa/merkle';
import type { MerkleProof, MerkleVerifyReason } from '@vaa/merkle';
import type { EvidenceObject } from './schema.js';
import type { EvidenceError } from './errors.js';
import { schemaInvalid, deserialiseTruncated } from './errors.js';

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
const decoder = new TextDecoder('utf-8', { fatal: true });
const VALUE_VERSION = 0x01;
const ROOT_PART_MAGIC = Uint8Array.of(0x56, 0x41, 0x52, 0x50); // "VARP" — field-tree root part

const KIND_TO_BYTE: Record<AccountingKind, number> = {
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

// Canonical value encodings (a leading version byte, then the value bytes;
// numbers are fixed-width 8-byte big-endian minor units).
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

// The canonical (tag, value) encoding that is hashed as a leaf.
export function serialiseField(field: AccountingField): Uint8Array {
  const tagBytes = encoder.encode(field.tag);
  return concat(writeVarInt(BigInt(tagBytes.length)), tagBytes, writeVarInt(BigInt(field.value.length)), field.value);
}

export function deserialiseField(bytes: Uint8Array): Result<AccountingField, EvidenceError> {
  const tagLen = readVarInt(bytes, 0);
  if (!tagLen.ok) return { ok: false, error: deserialiseTruncated() };
  let off = tagLen.value.nextOffset;
  const tn = Number(tagLen.value.value);
  if (off + tn > bytes.length) return { ok: false, error: deserialiseTruncated() };
  let tag: string;
  try {
    tag = decoder.decode(bytes.subarray(off, off + tn));
  } catch {
    return { ok: false, error: schemaInvalid('tag', 'invalid UTF-8') };
  }
  off += tn;
  const valLen = readVarInt(bytes, off);
  if (!valLen.ok) return { ok: false, error: deserialiseTruncated() };
  off = valLen.value.nextOffset;
  const vn = Number(valLen.value.value);
  if (off + vn > bytes.length) return { ok: false, error: deserialiseTruncated() };
  return { ok: true, value: { tag, value: Uint8Array.from(bytes.subarray(off, off + vn)) } };
}

export function fieldLeaf(field: AccountingField): Hash {
  return hashLeaf(serialiseField(field));
}

export function fieldLeaves(tx: AccountingTransaction): Hash[] {
  return tx.fields.map((f) => fieldLeaf(f));
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

// CARRIAGE IN ONE BITCOIN (BSV) TRANSACTION (no OP_RETURN, ever). scripts[0]
// carries the whole field set; scripts[1..2] carry the 32-byte root held in two
// parts. See docs/DECISIONS.md D5.
export function buildAccountingTx(
  tx: AccountingTransaction,
): Result<{ lockingScripts: Script[]; fieldTreeRoot: Hash }, EvidenceError> {
  const root = fieldTreeRoot(tx);
  if (!root.ok) return { ok: false, error: root.error };

  const fieldSet = serialiseFieldSet(tx);
  const env0 = buildScriptDataEnvelope(fieldSet);
  if (!env0.ok) return { ok: false, error: schemaInvalid('fields', 'field set too large for one envelope') };

  const rootBytes = HashOps.toInternalBytes(root.value);
  const part0 = concat(ROOT_PART_MAGIC, Uint8Array.of(0x00), rootBytes.subarray(0, 16));
  const part1 = concat(ROOT_PART_MAGIC, Uint8Array.of(0x01), rootBytes.subarray(16, 32));
  const env1 = buildScriptDataEnvelope(part0);
  const env2 = buildScriptDataEnvelope(part1);
  if (!env1.ok || !env2.ok) return { ok: false, error: schemaInvalid('root', 'root part too large for one envelope') };

  return { ok: true, value: { lockingScripts: [env0.value.lockingScript, env1.value.lockingScript, env2.value.lockingScript], fieldTreeRoot: root.value } };
}

function serialiseFieldSet(tx: AccountingTransaction): Uint8Array {
  const parts: Uint8Array[] = [Uint8Array.of(0x01), Uint8Array.of(KIND_TO_BYTE[tx.kind]), writeVarInt(BigInt(tx.fields.length))];
  for (const f of tx.fields) parts.push(serialiseField(f));
  return concat(...parts);
}

export function parseAccountingTx(scripts: Script[]): Result<AccountingTransaction, EvidenceError> {
  if (scripts.length === 0) return { ok: false, error: schemaInvalid('scripts', 'no scripts') };
  const payload = recognise(scripts[0] as Script);
  if (!payload.ok) return { ok: false, error: schemaInvalid('scripts', 'first script is not a data envelope') };
  const bytes = payload.value;
  if (bytes.length < 2 || bytes[0] !== 0x01) return { ok: false, error: deserialiseTruncated() };
  const kind = BYTE_TO_KIND[bytes[1] as number];
  if (kind === undefined) return { ok: false, error: schemaInvalid('kind', `unknown kind byte ${bytes[1]}`) };
  const count = readVarInt(bytes, 2);
  if (!count.ok) return { ok: false, error: deserialiseTruncated() };
  let off = count.value.nextOffset;
  const n = Number(count.value.value);
  const fields: AccountingField[] = [];
  for (let i = 0; i < n; i++) {
    const fieldResult = deserialiseField(bytes.subarray(off));
    if (!fieldResult.ok) return fieldResult;
    fields.push(fieldResult.value);
    off += serialiseField(fieldResult.value).length;
  }
  return { ok: true, value: { kind, fields } };
}

// PER-FIELD SELECTIVE DISCLOSURE.
export function discloseField(
  tx: AccountingTransaction,
  fieldIndex: number,
): Result<{ field: AccountingField; proof: MerkleProof; root: Hash }, EvidenceError> {
  const field = tx.fields[fieldIndex];
  if (field === undefined) return { ok: false, error: schemaInvalid('fieldIndex', 'out of range') };
  const leaves = fieldLeaves(tx);
  const proof = merkleProof(leaves, fieldIndex);
  if (!proof.ok) return { ok: false, error: schemaInvalid('fieldIndex', 'out of range') };
  const root = computeRoot(leaves);
  if (!root.ok) return { ok: false, error: schemaInvalid('fields', 'empty') };
  return { ok: true, value: { field, proof: proof.value, root: root.value } };
}

export function verifyDisclosedField(field: AccountingField, proof: MerkleProof, root: Hash): VerifyResult<MerkleVerifyReason> {
  return verifyProof(fieldLeaf(field), proof, root);
}
