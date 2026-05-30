import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashLeaf, hashNode, HashOps, TxidOps } from '@vaa/bsv';
import { buildTree, computeRoot, leafIndexOfTxid } from '@vaa/merkle';
import { randomLeaves } from './rng.mjs';

const leaf = (n: number) => hashLeaf(Uint8Array.of(n));
const a = leaf(1);
const b = leaf(2);
const c = leaf(3);
const d = leaf(4);
const e = leaf(5);

function unwrap<T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!r.ok) throw new Error('unexpected error ' + JSON.stringify(r.error));
  return r.value;
}

test('DB.1-T1 single leaf root is the leaf', () => {
  assert.equal(HashOps.equals(unwrap(buildTree([a])).root, a), true);
});

test('DB.1-T2 two-leaf root', () => {
  assert.equal(HashOps.equals(unwrap(buildTree([a, b])).root, hashNode(a, b)), true);
});

test('DB.1-T3 odd self-pair at three leaves', () => {
  const expected = hashNode(hashNode(a, b), hashNode(c, c));
  assert.equal(HashOps.equals(unwrap(buildTree([a, b, c])).root, expected), true);
});

test('DB.1-T4 four-leaf root', () => {
  const expected = hashNode(hashNode(a, b), hashNode(c, d));
  assert.equal(HashOps.equals(unwrap(buildTree([a, b, c, d])).root, expected), true);
});

test('DB.1-T5 five leaves (odd) with self-pair at the right boundary', () => {
  // level0: a b c d e ; level1: ab cd ee ; level2: (ab,cd) (ee,ee) ; root
  const ab = hashNode(a, b);
  const cd = hashNode(c, d);
  const ee = hashNode(e, e);
  const expected = hashNode(hashNode(ab, cd), hashNode(ee, ee));
  assert.equal(HashOps.equals(unwrap(buildTree([a, b, c, d, e])).root, expected), true);
});

test('DB.1-T6 computeRoot == buildTree(...).root for sizes 1..64 and 1000', () => {
  for (const size of [...Array(64).keys()].map((i) => i + 1).concat([1000])) {
    const leaves = randomLeaves(size, size).map((x: Uint8Array) => hashLeaf(x));
    assert.equal(HashOps.equals(unwrap(computeRoot(leaves)), unwrap(buildTree(leaves)).root), true);
  }
});

test('DB.1-T7 empty leaves -> EmptyLeaves', () => {
  const r1 = buildTree([]);
  const r2 = computeRoot([]);
  assert.equal(r1.ok, false);
  assert.equal(r2.ok, false);
  if (!r1.ok) assert.equal(r1.error.kind, 'EmptyLeaves');
});

test('DB.1-T8 leafIndexOfTxid finds present, undefined for absent', () => {
  const txids = [a, b, c].map((h) => unwrap(TxidOps.fromInternalBytes(HashOps.toInternalBytes(h))));
  const leaves = [a, b, c];
  assert.equal(leafIndexOfTxid(leaves, txids[1]!), 1);
  const absent = unwrap(TxidOps.fromInternalBytes(HashOps.toInternalBytes(d)));
  assert.equal(leafIndexOfTxid(leaves, absent), undefined);
});
