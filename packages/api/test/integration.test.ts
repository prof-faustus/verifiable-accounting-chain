import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HashOps } from '@vaa/bsv';
import { buildContext, makeKey, keyJson, authHeaders, leavesHex, proofSiblingsHex, rootHexOf } from './app.mjs';

function post(app: { handle: (r: { method: string; path: string; headers: Record<string, string | undefined>; body: unknown }) => { status: number; json: unknown } }, path: string, headers: Record<string, string | undefined>, body: unknown) {
  return app.handle({ method: 'POST', path, headers, body });
}

test('E.9 T-int-1 anchor -> prove -> query -> verify end to end', () => {
  const { app, leaves, root } = buildContext();
  const index = 6;

  assert.equal(app.handle({ method: 'GET', path: '/healthz', headers: {}, body: undefined }).status, 200);
  assert.equal(app.handle({ method: 'GET', path: '/readyz', headers: {}, body: undefined }).status, 200);

  const anchored = post(app, '/anchor', authHeaders(), { accountingTransaction: { kind: 'invoice', fields: [{ tag: 'invoice.net', valueHex: '0100000000000003e8' }] } });
  assert.equal(anchored.status, 200);
  assert.ok(typeof (anchored.json as { fieldTreeRootHex: string }).fieldTreeRootHex === 'string');

  const proved = post(app, '/prove', authHeaders(), { leavesHex: leavesHex(leaves), index });
  assert.equal(proved.status, 200);

  const queried = post(app, '/query', authHeaders(), { key: keyJson(makeKey(index)) });
  assert.equal(queried.status, 200);
  const storedProof = (queried.json as { storedProof: unknown }).storedProof;

  const verified = post(app, '/verify', authHeaders(), {
    leafHex: HashOps.toDisplayHex(leaves[index]!),
    rootHex: rootHexOf(root),
    proof: { index, siblingsHex: proofSiblingsHex(leaves, index) },
    stored: storedProof,
  });
  assert.equal(verified.status, 200);
  assert.deepEqual(verified.json, { ok: true });
});

test('E.9 T-int-2 authentication accepts valid and rejects invalid callers', () => {
  const { app, leaves } = buildContext();
  const body = { leavesHex: leavesHex(leaves), index: 0 };
  assert.equal(post(app, '/prove', {}, body).status, 401);
  assert.equal(post(app, '/prove', { 'x-api-key': 'wrong' }, body).status, 401);
  assert.equal(post(app, '/prove', authHeaders(), body).status, 200);
});

test('E.9 T-int-3 rate limiting triggers under burst', () => {
  const { app, leaves } = buildContext({ perMinute: 3 });
  const body = { leavesHex: leavesHex(leaves), index: 0 };
  for (let i = 0; i < 3; i++) assert.equal(post(app, '/prove', authHeaders(), body).status, 200);
  const limited = post(app, '/prove', authHeaders(), body);
  assert.equal(limited.status, 429);
});

test('E.9 T-int-4 verify refuses a trusted-operational result', () => {
  const { app, leaves, root } = buildContext();
  const index = 4;
  const queried = post(app, '/query', authHeaders(), { key: keyJson(makeKey(index)) });
  const storedProof = (queried.json as { storedProof: unknown }).storedProof;
  const verified = post(app, '/verify', authHeaders(), {
    leafHex: HashOps.toDisplayHex(leaves[index]!),
    rootHex: rootHexOf(root),
    proof: { index, siblingsHex: proofSiblingsHex(leaves, index) },
    stored: storedProof,
    mode: 'trustedOperational',
  });
  assert.equal(verified.status, 200);
  assert.equal((verified.json as { ok: boolean }).ok, false);
  assert.equal((verified.json as { reason: { kind: string } }).reason.kind, 'TrustedOperationalNotAcceptedForAudit');
});

test('E.9 T-int-5 malformed requests are rejected with typed BadRequest', () => {
  const { app } = buildContext();
  const r = post(app, '/anchor', authHeaders(), { accountingTransaction: { kind: 'invoice', fields: 'not-an-array' } });
  assert.equal(r.status, 400);
  assert.equal((r.json as { error: { kind: string } }).error.kind, 'BadRequest');
});
