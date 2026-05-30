import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HashOps, containsOpReturn } from '@vaa/bsv';
import { computeRoot, heightForLeafCount } from '@vaa/merkle';
import {
  fieldLeaves,
  fieldTreeRoot,
  buildAccountingTx,
  parseAccountingTx,
  discloseField,
  verifyDisclosedField,
  bigInvoiceTransaction,
} from '@vaa/evidence';

function unwrap<T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!r.ok) throw new Error('unexpected error ' + JSON.stringify(r.error));
  return r.value;
}

function contains(haystack: Uint8Array, needle: Uint8Array): boolean {
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) if (haystack[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}

test('D.4 T-ft-1 fieldLeaves deterministic; fieldTreeRoot == computeRoot(fieldLeaves)', () => {
  const tx = bigInvoiceTransaction(20);
  const a = fieldLeaves(tx);
  const b = fieldLeaves(tx);
  for (let i = 0; i < a.length; i++) assert.equal(HashOps.equals(a[i]!, b[i]!), true);
  assert.equal(HashOps.equals(unwrap(fieldTreeRoot(tx)), unwrap(computeRoot(a))), true);
});

test('D.4 T-ft-2 buildAccountingTx/parseAccountingTx round-trip a 1000-field invoice across multiple outputs; no OP_RETURN', () => {
  const tx = bigInvoiceTransaction(1000);
  const built = unwrap(buildAccountingTx(tx));
  assert.ok(built.lockingScripts.length > 1, 'should span multiple envelope outputs');
  for (const s of built.lockingScripts) assert.equal(containsOpReturn(s), false);
  const parsed = unwrap(parseAccountingTx(built.lockingScripts));
  assert.equal(parsed.tx.kind, 'invoice');
  assert.equal(parsed.tx.fields.length, 1000);
  for (let i = 0; i < tx.fields.length; i++) {
    assert.equal(parsed.tx.fields[i]!.tag, tx.fields[i]!.tag);
    assert.deepEqual(Array.from(parsed.tx.fields[i]!.value), Array.from(tx.fields[i]!.value));
  }
});

test('D.4 T-ft-3 disclose one field of a 1000-field invoice; no other field value appears', () => {
  const tx = bigInvoiceTransaction(1000);
  const target = 500;
  const d = unwrap(discloseField(tx, target));
  assert.equal(verifyDisclosedField(d.leafIndex, d.field, d.proof, d.root).ok, true);
  assert.equal(d.field.tag, tx.fields[target]!.tag);
  const proofBytes = new Uint8Array(d.proof.siblings.flatMap((h) => Array.from(HashOps.toInternalBytes(h))));
  for (let i = 0; i < tx.fields.length; i++) {
    if (i === target) continue;
    const v = tx.fields[i]!.value;
    if (v.length >= 4) assert.equal(contains(proofBytes, v), false);
  }
});

test('D.4 T-ft-4 tampered value or wrong proof fails', () => {
  const tx = bigInvoiceTransaction(64);
  const d = unwrap(discloseField(tx, 10));
  const tampered = Uint8Array.from(d.field.value);
  tampered[1] = (tampered[1]! ^ 0xff) & 0xff;
  assert.equal(verifyDisclosedField(d.leafIndex, { tag: d.field.tag, value: tampered }, d.proof, d.root).ok, false);
  const other = unwrap(discloseField(tx, 11));
  assert.equal(verifyDisclosedField(d.leafIndex, d.field, other.proof, d.root).ok, false);
});

test('D.4 T-ft-5 proof size grows as log2(field count)', () => {
  let prev = -1;
  for (const count of [16, 128, 1024, 4096]) {
    const d = unwrap(discloseField(bigInvoiceTransaction(count), 1));
    assert.equal(d.proof.siblings.length, heightForLeafCount(count));
    assert.ok(d.proof.siblings.length > prev);
    prev = d.proof.siblings.length;
  }
});
