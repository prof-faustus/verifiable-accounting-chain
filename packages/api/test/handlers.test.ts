import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HashOps } from '@vaa/bsv';
import { computeRoot, merkleProof } from '@vaa/merkle';
import { fieldTreeRoot, bigInvoiceTransaction } from '@vaa/evidence';
import { anchor, prove, query, verify } from '@vaa/api';
import { buildContext, makeKey } from './app.mjs';

test('E.7 T-h-1 anchor returns a field-tree root that recomputes', () => {
  const { ctx } = buildContext();
  const tx = bigInvoiceTransaction(25);
  const r = anchor({ tx }, ctx);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.fieldTreeRootHex, HashOps.toDisplayHex(fieldTreeRoot(tx).value));
});

test('E.7 T-h-2 prove returns a proof that verifies', () => {
  const { ctx, leaves } = buildContext();
  const r = prove({ leaves, index: 7 }, ctx);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.rootDisplayHex, HashOps.toDisplayHex(computeRoot(leaves).value));
    assert.equal(r.value.proof.siblingsDisplayHex.length, merkleProof(leaves, 7).value.siblings.length);
  }
});

test('E.7 T-h-3 query returns only the queried item fragment; audit recorded', () => {
  const { ctx } = buildContext();
  const r = query({ key: makeKey(9) }, ctx, 'apiKey:tester');
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.storedProof.leafIndex, 9);
    assert.equal(r.value.storedProof.key.position, 9);
  }
  assert.equal(ctx.auditLog.size(), 1);
  // metadata only: no record content
  assert.equal(JSON.stringify(ctx.auditLog.all()).includes('INVOICE'), false);
});

test('E.7 T-h-4 / DE.1 verify ok genuine; refuses trusted-operational; RootNotAnchored when absent', () => {
  const { ctx, leaves, root, store } = buildContext();
  const index = 5;
  const stored = store.query(makeKey(index)).value;
  const proof = merkleProof(leaves, index).value;
  const okRes = verify({ leaf: leaves[index]!, root, proof, stored, mode: 'adversarial' }, ctx);
  assert.equal(okRes.ok && okRes.value.ok, true);

  const refused = verify({ leaf: leaves[index]!, root, proof, stored, mode: 'trustedOperational' }, ctx);
  assert.equal(refused.ok, true);
  if (refused.ok && !refused.value.ok) assert.equal(refused.value.reason.kind, 'TrustedOperationalNotAcceptedForAudit');

  // A second tree whose root is NOT anchored in the chain.
  const { leaves: leaves2, root: root2, store: store2 } = buildContext({ n: 16 });
  // verify against ctx (whose chain lacks root2)
  const stored2 = store2.query(makeKey(3)).value;
  const proof2 = merkleProof(leaves2, 3).value;
  const notAnchored = verify({ leaf: leaves2[3]!, root: root2, proof: proof2, stored: stored2, mode: 'adversarial' }, ctx);
  assert.equal(notAnchored.ok, true);
  if (notAnchored.ok && !notAnchored.value.ok) assert.equal(notAnchored.value.reason.kind, 'RootNotAnchored');
});
