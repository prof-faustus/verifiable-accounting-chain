import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HashOps, TxidOps, HeaderChain, meetsTarget } from '@vaa/bsv';
import type { BlockHeader, Hash } from '@vaa/bsv';
import { ProofStore } from '@vaa/proofstore';
import { bigInvoiceTransaction, fieldTreeRoot } from '@vaa/evidence';
import { loadConfig, createApp, AuditLog, Logger, ChainService } from '@vaa/api';

const enc = (s: string) => new TextEncoder().encode(s);

function syntheticHeaderFor(root: Hash): BlockHeader {
  let header: BlockHeader = { version: 1, prevBlockHash: HashOps.zero(), merkleRoot: root, time: 0, bits: 0x2100ffff, nonce: 0 };
  while (!meetsTarget(header)) header = { ...header, nonce: header.nonce + 1 };
  return header;
}

function buildApp() {
  const cfg = loadConfig({ NODE_ENDPOINT: 'https://x', NETWORK: 'mainnet', PREDETERMINED_LEVEL: '2', AUTH_SCHEME: 'apiKey', AUTH_CREDENTIALS: 'k', RATE_LIMIT_PER_MINUTE: '100', LOG_LEVEL: 'error' });
  if (!cfg.ok) throw new Error('config');
  const chainService = new ChainService(enc('api-chain-seed'), enc('entity'), enc('period'));
  const headerChain = new HeaderChain();
  const ctx = {
    config: cfg.value,
    headerChain,
    proofStore: new ProofStore(2),
    auditLog: new AuditLog(),
    logger: new Logger('error', { write() {} }),
    now: () => 0,
    rootPub: chainService.rootPubPoint(),
    genesisMsg: chainService.genesis(),
    chainBackend: chainService,
  };
  return { app: createApp(ctx), headerChain };
}

const auth = { 'x-api-key': 'k' };

test('E.4.1 chain append/verify and bundle issue/verify end to end', () => {
  const { app, headerChain } = buildApp();
  const invoice = bigInvoiceTransaction(32);
  const ftr = fieldTreeRoot(invoice).value;

  // append link 0 (genesis) and link 1 (the invoice tx)
  const txid0 = TxidOps.toDisplayHex(TxidOps.fromInternalBytes(new Uint8Array(32).fill(1)).value);
  const r0 = app.handle({ method: 'POST', path: '/chain/append', headers: auth, body: { txidHex: txid0, fieldRootHex: HashOps.toDisplayHex(HashOps.zero()) } });
  assert.equal(r0.status, 200);

  const ourTxidVal = TxidOps.fromInternalBytes(new Uint8Array(32).fill(2)).value;
  const ourTxid = TxidOps.toDisplayHex(ourTxidVal);
  const r1 = app.handle({ method: 'POST', path: '/chain/append', headers: auth, body: { txidHex: ourTxid, fieldRootHex: HashOps.toDisplayHex(ftr) } });
  assert.equal(r1.status, 200);
  assert.equal((r1.json as { index: number }).index, 1);

  // chain verifies
  const cv = app.handle({ method: 'GET', path: '/chain/verify', headers: auth, body: undefined });
  assert.equal(cv.status, 200);
  assert.deepEqual(cv.json, { ok: true });

  // anchor the invoice tx (single-tx block whose root is its txid)
  const blockRoot = HashOps.fromInternalBytes(TxidOps.toInternalBytes(ourTxidVal)).value;
  headerChain.add(syntheticHeaderFor(blockRoot));

  // issue a bundle for one field
  const issue = app.handle({
    method: 'POST',
    path: '/bundle/issue',
    headers: auth,
    body: {
      accountingTransaction: { kind: invoice.kind, fields: invoice.fields.map((f) => ({ tag: f.tag, valueHex: Buffer.from(f.value).toString('hex') })) },
      fieldIndices: [3],
      chainIndex: 1,
      inclusion: { txidHex: ourTxid, merklePath: { index: 0, siblingsHex: [] } },
    },
  });
  assert.equal(issue.status, 200);
  const bundle = (issue.json as { bundle: unknown }).bundle;

  // verify the bundle (terminates in the header chain)
  const ver = app.handle({ method: 'POST', path: '/bundle/verify', headers: auth, body: { bundle } });
  assert.equal(ver.status, 200);
  assert.deepEqual(ver.json, { ok: true });
});

test('E.4.1 a tampered bundle fails verification', () => {
  const { app, headerChain } = buildApp();
  const invoice = bigInvoiceTransaction(16);
  const ftr = fieldTreeRoot(invoice).value;
  app.handle({ method: 'POST', path: '/chain/append', headers: auth, body: { txidHex: TxidOps.toDisplayHex(TxidOps.fromInternalBytes(new Uint8Array(32).fill(1)).value), fieldRootHex: HashOps.toDisplayHex(HashOps.zero()) } });
  const ourTxidVal = TxidOps.fromInternalBytes(new Uint8Array(32).fill(2)).value;
  app.handle({ method: 'POST', path: '/chain/append', headers: auth, body: { txidHex: TxidOps.toDisplayHex(ourTxidVal), fieldRootHex: HashOps.toDisplayHex(ftr) } });
  headerChain.add(syntheticHeaderFor(HashOps.fromInternalBytes(TxidOps.toInternalBytes(ourTxidVal)).value));
  const issue = app.handle({
    method: 'POST',
    path: '/bundle/issue',
    headers: auth,
    body: {
      accountingTransaction: { kind: invoice.kind, fields: invoice.fields.map((f) => ({ tag: f.tag, valueHex: Buffer.from(f.value).toString('hex') })) },
      fieldIndices: [2],
      chainIndex: 1,
      inclusion: { txidHex: TxidOps.toDisplayHex(ourTxidVal), merklePath: { index: 0, siblingsHex: [] } },
    },
  });
  const bundle = (issue.json as { bundle: { disclosedFields: { tag: string; valueHex: string }[] } }).bundle;
  const hex = bundle.disclosedFields[0]!.valueHex;
  bundle.disclosedFields[0]!.valueHex = hex.slice(0, -1) + (hex.slice(-1) === '0' ? '1' : '0');
  const ver = app.handle({ method: 'POST', path: '/bundle/verify', headers: auth, body: { bundle } });
  assert.equal(ver.status, 200);
  assert.equal((ver.json as { ok: boolean }).ok, false);
});
