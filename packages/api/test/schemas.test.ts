import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAnchorRequest, parseProveRequest, parseQueryRequest, parseVerifyRequest } from '@vaa/api';
import { HashOps, TxidOps } from '@vaa/bsv';

const someHash = HashOps.toDisplayHex(HashOps.zero());
const someTxid = TxidOps.toDisplayHex(TxidOps.fromInternalBytes(new Uint8Array(32)).value);

test('E.6 T-sch-1 anchor schema accepts valid and rejects malformed', () => {
  assert.equal(parseAnchorRequest({ accountingTransaction: { kind: 'invoice', fields: [{ tag: 'a', valueHex: '00' }] } }).ok, true);
  const r = parseAnchorRequest({ accountingTransaction: { kind: 'nope', fields: [] } });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.field, 'kind');
});

test('E.6 T-sch-1 prove schema accepts valid and rejects malformed', () => {
  assert.equal(parseProveRequest({ leavesHex: [someHash, someHash], index: 1 }).ok, true);
  const r = parseProveRequest({ leavesHex: [someHash], index: 5 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.field, 'index');
});

test('E.6 T-sch-1 query schema accepts valid and rejects malformed', () => {
  assert.equal(parseQueryRequest({ key: { txidHex: someTxid, direction: 'output', position: 0, blockPosition: 0 } }).ok, true);
  const r = parseQueryRequest({ key: { txidHex: someTxid, direction: 'sideways', position: 0, blockPosition: 0 } });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.field, 'key.direction');
});

test('E.6 T-sch-1 verify schema accepts valid and rejects malformed', () => {
  const valid = {
    leafHex: someHash,
    rootHex: someHash,
    proof: { index: 0, siblingsHex: [someHash] },
    stored: {
      key: { txidHex: someTxid, direction: 'output', position: 0, blockPosition: 0 },
      leafIndex: 0,
      shards: [{ fromLevel: 0, toLevel: 1, siblingsHex: [someHash] }],
      expectedRootHex: someHash,
    },
  };
  assert.equal(parseVerifyRequest(valid).ok, true);
  const r = parseVerifyRequest({ ...valid, leafHex: 'zz' });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.field, 'leafHex');
});
