import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OfflineNodeClient,
  LiveNodeClient,
  TxidOps,
  HashOps,
} from '@vaa/bsv';
import { txFixture, blockFixture, headersFixture, hexToBytes, buildHeader, unwrap } from './load.mjs';

async function offlineDataset() {
  const headerValues = await Promise.all(headersFixture.headers.map(buildHeader));
  const headerByBlockHash = new Map();
  const headersByHeight = [];
  headersFixture.headers.forEach((rec, i) => {
    headerByBlockHash.set(rec.hash, headerValues[i]);
    headersByHeight[rec.height] = headerValues[i];
  });
  return {
    transactionsByTxid: new Map([[txFixture.txid, hexToBytes(txFixture.rawHex)]]),
    blockTxids: new Map([[blockFixture.blockHash, blockFixture.txids.map((t) => unwrap(TxidOps.fromDisplayHex(t)))]]),
    headerByBlockHash,
    headersByHeight,
  };
}

test('T-node-1 OfflineNodeClient serves fixtures; NodeNotFound for unknown', async () => {
  const client = new OfflineNodeClient(await offlineDataset());
  const txid = unwrap(TxidOps.fromDisplayHex(txFixture.txid));
  const tx = unwrap(await client.getTransaction(txid));
  assert.equal(TxidOps.toDisplayHex(TxidOps.ofTransactionBytes(tx.raw)), txFixture.txid);

  const blockHash = unwrap(HashOps.fromDisplayHex(blockFixture.blockHash));
  const txids = unwrap(await client.getBlockTxids(blockHash));
  assert.deepEqual(txids.map((t) => TxidOps.toDisplayHex(t)), blockFixture.txids);

  const header = unwrap(await client.getHeader(blockHash));
  assert.equal(HashOps.toDisplayHex(header.merkleRoot), blockFixture.merkleRoot);

  const fromHeight = unwrap(await client.getHeadersFrom(179, 3));
  assert.equal(fromHeight.length, 3);

  const unknown = unwrap(TxidOps.fromDisplayHex('aa'.repeat(32)));
  const miss = await client.getTransaction(unknown);
  assert.equal(miss.ok, false);
  if (!miss.ok) assert.equal(miss.error.kind, 'NodeNotFound');
});

function transportOf(scripted) {
  return { request: async () => scripted };
}

test('T-node-2 LiveNodeClient error and success paths', async () => {
  const txid = unwrap(TxidOps.fromDisplayHex(txFixture.txid));

  const throwing = new LiveNodeClient({ request: async () => { throw new Error('network down'); } });
  const e1 = await throwing.getTransaction(txid);
  assert.equal(e1.ok, false);
  if (!e1.ok) assert.equal(e1.error.kind, 'NodeUnreachable');

  const unreachable = new LiveNodeClient(transportOf({ kind: 'unreachable', detail: 'timeout' }));
  const e2 = await unreachable.getTransaction(txid);
  if (!e2.ok) assert.equal(e2.error.kind, 'NodeUnreachable');

  const notFound = new LiveNodeClient(transportOf({ kind: 'notFound' }));
  const e3 = await notFound.getTransaction(txid);
  if (!e3.ok) assert.equal(e3.error.kind, 'NodeNotFound');

  const malformed = new LiveNodeClient(transportOf({ kind: 'ok', body: 'not-hex-zz' }));
  const e4 = await malformed.getTransaction(txid);
  if (!e4.ok) assert.equal(e4.error.kind, 'NodeBadResponse');

  const success = new LiveNodeClient(transportOf({ kind: 'ok', body: txFixture.rawHex }));
  const ok = unwrap(await success.getTransaction(txid));
  assert.equal(TxidOps.toDisplayHex(TxidOps.ofTransactionBytes(ok.raw)), txFixture.txid);
});
