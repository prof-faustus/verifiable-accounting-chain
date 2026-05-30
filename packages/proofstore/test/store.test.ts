import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HashOps } from '@vaa/bsv';
import { ProofStore } from '@vaa/proofstore';
import { makeLeaves, makeKey, unwrap } from './util.mjs';

const N = 16;
const K = 2;

function anchoredStore() {
  const leaves = makeLeaves(100, N);
  const store = new ProofStore(K);
  for (let i = 0; i < N; i++) unwrap(store.anchor(makeKey(i), leaves, i));
  return { store, leaves };
}

test('DC.4-T1 anchor then query; KeyNotFound for an un-anchored key', () => {
  const { store } = anchoredStore();
  const stored = unwrap(store.query(makeKey(3)));
  assert.equal(stored.leafIndex, 3);
  const miss = store.query(makeKey(999));
  assert.equal(miss.ok, false);
  if (!miss.ok) assert.equal(miss.error.kind, 'KeyNotFound');
});

test('DC.4-T2 verify(adversarial) ok genuine; wrong leaf/index/root/missing/altered shard not ok', () => {
  const { store, leaves } = anchoredStore();
  const stored = unwrap(store.query(makeKey(5)));
  assert.equal(store.verify(leaves[5]!, stored, 'adversarial').ok, true);
  // wrong leaf
  assert.equal(store.verify(leaves[6]!, stored, 'adversarial').ok, false);
  // wrong index
  assert.equal(store.verify(leaves[5]!, { ...stored, leafIndex: 7 }, 'adversarial').ok, false);
  // wrong root
  const badRootBytes = HashOps.toInternalBytes(stored.expectedRoot);
  badRootBytes[0] = badRootBytes[0]! ^ 0xff;
  assert.equal(store.verify(leaves[5]!, { ...stored, expectedRoot: HashOps.fromInternalBytes(badRootBytes).value }, 'adversarial').ok, false);
  // missing shard (drop the upper)
  const lowerOnly = { ...stored, shards: stored.shards.filter((s) => s.fromLevel === 0) };
  assert.equal(store.verify(leaves[5]!, lowerOnly, 'adversarial').ok, false);
  // altered shard
  const sib = HashOps.toInternalBytes(stored.shards[0]!.siblings[0]!);
  sib[0] = sib[0]! ^ 0xff;
  const altered = {
    ...stored,
    shards: [{ ...stored.shards[0]!, siblings: [HashOps.fromInternalBytes(sib).value, ...stored.shards[0]!.siblings.slice(1)] }, stored.shards[1]!],
  };
  assert.equal(store.verify(leaves[5]!, altered, 'adversarial').ok, false);
});

test('DC.4-T3 verifyWithAssistance ok via lower shard + labels; altered lower -> AssistanceMismatch', () => {
  const { store, leaves } = anchoredStore();
  const stored = unwrap(store.query(makeKey(9)));
  assert.equal(store.verifyWithAssistance(leaves[9]!, stored).ok, true);
  const sib = HashOps.toInternalBytes(stored.shards[0]!.siblings[0]!);
  sib[0] = sib[0]! ^ 0xff;
  const altered = {
    ...stored,
    shards: [{ ...stored.shards[0]!, siblings: [HashOps.fromInternalBytes(sib).value, ...stored.shards[0]!.siblings.slice(1)] }, stored.shards[1]!],
  };
  const r = store.verifyWithAssistance(leaves[9]!, altered);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason.kind, 'AssistanceMismatch');
});

test('DC.4-T4 verify(...,"trustedOperational") -> TrustedOperationalNotAcceptedForAudit', () => {
  const { store, leaves } = anchoredStore();
  const stored = unwrap(store.query(makeKey(1)));
  const r = store.verify(leaves[1]!, stored, 'trustedOperational');
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason.kind, 'TrustedOperationalNotAcceptedForAudit');
});
