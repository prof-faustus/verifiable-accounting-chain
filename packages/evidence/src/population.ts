// Population helpers: anchoring accounting records as Bitcoin (BSV) data items
// (each record's canonical serialisation is a leaf), and building field-rich
// accounting transactions for the field tree.
import type { Hash } from '@vaa/bsv';
import { hashLeaf } from '@vaa/bsv';
import type { EvidenceObject } from './schema.js';
import { serializeEvidence } from './serialise.js';
import type { AccountingTransaction, AccountingField } from './fieldtree.js';
import { numericValue, stringValue } from './fieldtree.js';

// A record committed on-chain is the canonical serialisation of the object; its
// leaf is the double-SHA256 of those bytes.
export function recordLeaf(obj: EvidenceObject): Hash {
  return hashLeaf(serializeEvidence(obj));
}

export function populationLeaves(objs: EvidenceObject[]): Hash[] {
  return objs.map((o) => recordLeaf(o));
}

// A field-rich invoice accounting transaction with the requested number of
// fields, for field-tree and selective-disclosure tests/studies. Header fields
// plus per-line net amounts; all values deterministic.
export function bigInvoiceTransaction(fieldCount: number): AccountingTransaction {
  const fields: AccountingField[] = [
    { tag: 'invoice.number', value: stringValue('INV-' + fieldCount) },
    { tag: 'invoice.date', value: stringValue('2026-05-30') },
    { tag: 'invoice.currency', value: stringValue('minor-units') },
  ];
  let i = 0;
  while (fields.length < fieldCount) {
    fields.push({ tag: `line[${i}].net`, value: numericValue(BigInt(1000 + i * 7)) });
    i++;
  }
  return { kind: 'invoice', fields: fields.slice(0, fieldCount) };
}
