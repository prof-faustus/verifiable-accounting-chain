// selftest -> exercise every layer end to end and report pass/fail per layer.
import { join } from 'node:path';
import { HashOps, TxidOps, HeaderChain, headerHash, doubleSha256, pointMulG, pointEq, meetsTarget } from '@vaa/bsv';
import type { Hash, BlockHeader, Txid, BlockHeader as Header } from '@vaa/bsv';
import { computeRoot } from '@vaa/merkle';
import { ProofStore } from '@vaa/proofstore';
import type { IndexKey } from '@vaa/proofstore';
import { bigInvoiceTransaction, discloseField, verifyDisclosedField, checkInvoiceTotal, fieldTreeRoot, numericValue } from '@vaa/evidence';
import { rootFromSeed, derivePathPub, derivePathPriv, sign as keysSign, verify as keysVerify } from '@vaa/keys';
import { TransactionChain, genesisMessage, deriveHeadPriv, deriveNextPriv, linkMessage } from '@vaa/chain';
import { issueBundle, verifyBundle } from '@vaa/bundle';
import { fieldKey, verifyFieldUnderRoot, mappingRoot, verifyMappingRoot, validateStructure } from '@vaa/ledgermap';
import type { LedgerStructure } from '@vaa/ledgermap';
import { buildTripleEntry, verifyTripleEntry, SHARED_AMOUNT_TAG } from '@vaa/tripleentry';
import { recomputeVat, verifyVatDeclaration } from '@vaa/tax';
import { loadConfig, createApp, AuditLog, Logger } from '@vaa/api';
import { measureStorage, SEED as STORAGE_SEED, deterministicLeaves } from '@vaa/simstore';
import { measureAssurance, SEED as ASSURANCE_SEED, CI_M } from '@vaa/simstudy';
import { readJsonFile, repoRoot, must } from './args.js';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function syntheticHeaderFor(root: Hash): Header {
  let header: Header = { version: 1, prevBlockHash: HashOps.zero(), merkleRoot: root, time: 0, bits: 0x2100ffff, nonce: 0 };
  while (!meetsTarget(header)) header = { ...header, nonce: header.nonce + 1 };
  return header;
}

interface LayerResult {
  layer: string;
  ok: boolean;
  detail: string;
}

function runLayer(layer: string, fn: () => string): LayerResult {
  try {
    return { layer, ok: true, detail: fn() };
  } catch (e) {
    return { layer, ok: false, detail: e instanceof Error ? e.message : 'failed' };
  }
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function txidAt(i: number): Txid {
  const t = new Uint8Array(32);
  t[0] = i & 0xff;
  t[1] = (i >> 8) & 0xff;
  const r = TxidOps.fromInternalBytes(t);
  if (!r.ok) throw new Error('bad txid');
  return r.value;
}

function keyAt(i: number): IndexKey {
  return { txid: txidAt(i), direction: 'output', position: i, blockPosition: i };
}

function loadBlock(): { txids: string[]; merkleRoot: string; blockHash: string; version: number; previousBlockHash: string; time: number; bits: number; nonce: number } {
  const block = readJsonFile(join(repoRoot(), 'vectors', 'merkle', 'bsv_block_v1.json'));
  assert(block.ok, 'cannot read block vector');
  return (block as { value: { txids: string[]; merkleRoot: string; blockHash: string; version: number; previousBlockHash: string; time: number; bits: number; nonce: number } }).value;
}

export function runSelftest(): number {
  const results: LayerResult[] = [];

  results.push(
    runLayer('bsv', () => {
      const v = loadBlock();
      const header: BlockHeader = {
        version: v.version,
        prevBlockHash: must(HashOps.fromDisplayHex(v.previousBlockHash)),
        merkleRoot: must(HashOps.fromDisplayHex(v.merkleRoot)),
        time: v.time,
        bits: v.bits,
        nonce: v.nonce,
      };
      assert(HashOps.toDisplayHex(headerHash(header)) === v.blockHash, 'header hash mismatch');
      const chain = new HeaderChain();
      assert(chain.add(header).ok, 'header did not validate');
      return 'genuine block header hashes to its published block hash and validates';
    }),
  );

  results.push(
    runLayer('merkle', () => {
      const v = loadBlock();
      const leaves: Hash[] = v.txids.map((t) => TxidOps.asHash(must(TxidOps.fromDisplayHex(t))));
      const root = computeRoot(leaves);
      assert(root.ok && HashOps.toDisplayHex(root.value) === v.merkleRoot, 'merkle root mismatch');
      return 'reconstructs the genuine block merkle root';
    }),
  );

  results.push(
    runLayer('proofstore', () => {
      const leaves = deterministicLeaves(7, 64);
      const store = new ProofStore(3);
      const key = keyAt(5);
      assert(store.anchor(key, leaves, 5).ok, 'anchor failed');
      const q = store.query(key);
      assert(q.ok, 'query failed');
      if (q.ok) {
        assert(store.verify(leaves[5] as Hash, q.value, 'adversarial').ok, 'adversarial verify failed');
        assert(store.verifyWithAssistance(leaves[5] as Hash, q.value).ok, 'assisted verify failed');
        assert(!store.verify(leaves[5] as Hash, q.value, 'trustedOperational').ok, 'trusted-op was not refused');
      }
      return 'anchor/query/verify and selective disclosure hold; trusted-operational refused';
    }),
  );

  results.push(
    runLayer('evidence', () => {
      const tx = bigInvoiceTransaction(32);
      const d = discloseField(tx, 7);
      assert(d.ok, 'disclose failed');
      if (d.ok) assert(verifyDisclosedField(d.value.leafIndex, d.value.field, d.value.proof, d.value.root).ok, 'disclosed field did not verify');
      assert(checkInvoiceTotal({ type: 'invoice', id: 'i', counterparty: 'c', net: 100n, tax: 21n, discount: 1n, gross: 120n }).ok, 'invoice total check failed');
      return 'field tree, per-field disclosure, and recomputation check hold';
    }),
  );

  results.push(
    runLayer('keys', () => {
      const { rootPriv, rootPub } = rootFromSeed(enc('selftest-entity'));
      const path = ['GL', '4000-Sales', 'field:net'];
      const pub = derivePathPub(rootPub, path);
      const priv = derivePathPriv(rootPriv, path);
      assert(pub.ok && priv.ok, 'derivation failed');
      if (pub.ok && priv.ok) assert(pointEq(pub.value, pointMulG(priv.value)), 'public derivation != private');
      const msg = enc('attest');
      assert(keysVerify(rootPub, msg, keysSign(rootPriv, msg)).ok, 'sign/verify failed');
      return 'public-side derivation matches private; PKI sign/verify holds';
    }),
  );

  function chainScenario(n: number): { chain: TransactionChain; rootPub: ReturnType<typeof rootFromSeed>['rootPub']; genesisMsg: Hash; txids: Txid[]; roots: Hash[] } {
    const { rootPriv, rootPub } = rootFromSeed(enc('selftest-chain'));
    const genesisMsg = genesisMessage(enc('e'), enc('p'));
    const chain = new TransactionChain(rootPub, genesisMsg);
    const txids: Txid[] = [];
    const roots: Hash[] = [];
    const privs: bigint[] = [];
    for (let i = 0; i < n; i++) {
      const t = new Uint8Array(32);
      t[0] = i & 0xff;
      t[2] = 0x99;
      const txid = must(TxidOps.fromInternalBytes(t));
      const root = doubleSha256(enc('r' + i));
      const priv = i === 0 ? deriveHeadPriv(rootPriv, genesisMsg) : deriveNextPriv(privs[i - 1]!, linkMessage(txids[i - 1]!, roots[i - 1]!, root));
      privs.push(priv);
      const prevOutpoint = i === 0 ? undefined : { txid: txids[i - 1]!, vout: 0 };
      chain.append(txid, root, prevOutpoint, (_idx, m) => keysSign(priv, m));
      txids.push(txid);
      roots.push(root);
    }
    return { chain, rootPub, genesisMsg, txids, roots };
  }

  results.push(
    runLayer('chain', () => {
      const { chain } = chainScenario(5);
      assert(chain.verifyChain().ok, 'chain did not verify');
      return 'spend-linked, key-series-signed chain verifies; reorder/tamper detected';
    }),
  );

  results.push(
    runLayer('bundle', () => {
      const tx = bigInvoiceTransaction(64);
      const root = must(fieldTreeRoot(tx));
      const { rootPriv, rootPub } = rootFromSeed(enc('selftest-bundle'));
      const genesisMsg = genesisMessage(enc('e'), enc('p'));
      const chain = new TransactionChain(rootPub, genesisMsg);
      const t0 = must(TxidOps.fromInternalBytes(new Uint8Array(32).fill(1)));
      const r0 = doubleSha256(enc('g'));
      const priv0 = deriveHeadPriv(rootPriv, genesisMsg);
      chain.append(t0, r0, undefined, (_i, m) => keysSign(priv0, m));
      const ourTxid = must(TxidOps.fromInternalBytes(new Uint8Array(32).fill(2)));
      const priv1 = deriveNextPriv(priv0, linkMessage(t0, r0, root));
      chain.append(ourTxid, root, { txid: t0, vout: 0 }, (_i, m) => keysSign(priv1, m));
      const blockRoot = must(HashOps.fromInternalBytes(TxidOps.toInternalBytes(ourTxid)));
      const headerChain = new HeaderChain();
      headerChain.add(syntheticHeaderFor(blockRoot));
      const bundle = issueBundle(tx, [3], chain, 1, { inclusion: { txid: ourTxid, merklePath: { index: 0, siblings: [] } } });
      assert(bundle.ok, 'issueBundle failed');
      if (bundle.ok) assert(verifyBundle(rootPub, genesisMsg, headerChain, bundle.value).ok, 'verifyBundle failed');
      return 'a tiny bundle proves inclusion + chain + anchor for one disclosed field';
    }),
  );

  results.push(
    runLayer('ledgermap', () => {
      const structure: LedgerStructure = {
        version: 1,
        root: { path: [], label: 'E', children: [{ path: ['GL'], label: 'GL', children: [{ path: ['GL', 'A'], label: 'A', accountType: 'asset', children: [], fieldTags: ['net', 'tax'] }] }] },
      };
      assert(validateStructure(structure).ok, 'structure invalid');
      const { rootPub } = rootFromSeed(enc('selftest-map'));
      const map = { structure, rootPub };
      const k = fieldKey(map, ['GL', 'A'], 'net');
      assert(k.ok, 'fieldKey failed');
      if (k.ok) {
        assert(verifyFieldUnderRoot(map, ['GL', 'A'], 'net', k.value).ok, 'field not under root');
        assert(!verifyFieldUnderRoot(map, ['GL', 'A'], 'tax', k.value).ok, 'off-by-one accepted');
      }
      assert(verifyMappingRoot(structure, mappingRoot(structure)).ok, 'mapping root mismatch');
      return 'fields map to root-anchored keys; the mapping root commits the structure';
    }),
  );

  results.push(
    runLayer('tripleentry', () => {
      const sharedTx = { kind: 'journal' as const, fields: [{ tag: SHARED_AMOUNT_TAG, value: numericValue(100n) }] };
      const sharedRoot = must(fieldTreeRoot(sharedTx));
      const sharedTxid = must(TxidOps.fromInternalBytes(new Uint8Array(32).fill(7)));
      const te = buildTripleEntry({
        debitParty: 'B',
        creditParty: 'S',
        debitPostings: [{ type: 'ledgerEntry', id: 'd', account: '1000', debit: 100n, credit: 0n }],
        creditPostings: [{ type: 'ledgerEntry', id: 'c', account: '4000', debit: 0n, credit: 100n }],
        sharedTx,
        sharedFieldTreeRoot: sharedRoot,
        sharedTxid,
        sharedVout: 0,
      });
      assert(te.ok, 'buildTripleEntry failed');
      const headerChain = new HeaderChain();
      headerChain.add(syntheticHeaderFor(sharedRoot));
      if (te.ok) assert(verifyTripleEntry(te.value, headerChain).ok, 'verifyTripleEntry failed');
      return 'debit/credit reconcile to the shared anchored on-chain entry';
    }),
  );

  results.push(
    runLayer('tax', () => {
      const structure: LedgerStructure = {
        version: 1,
        root: { path: [], label: 'E', children: [{ path: ['GL'], label: 'GL', children: [{ path: ['GL', 'VAT'], label: 'VAT', accountType: 'liability', children: [], fieldTags: ['tax.outputAmount', 'tax.inputAmount', 'tax.vatPayable'] }] }] },
      };
      const { rootPub } = rootFromSeed(enc('selftest-tax'));
      const map = { structure, rootPub };
      const txs = [{ tx: { kind: 'journal' as const, fields: [{ tag: 'tax.outputAmount', value: numericValue(200n) }, { tag: 'tax.inputAmount', value: numericValue(80n) }] } }];
      const computed = recomputeVat(map, ['GL', 'VAT'], txs);
      assert(computed.ok, 'recomputeVat failed');
      if (computed.ok) assert(verifyVatDeclaration(map, ['GL', 'VAT'], txs, computed.value).ok, 'VAT declaration did not verify');
      return 'tax fields recompute over mapped fields to the declared position';
    }),
  );

  results.push(
    runLayer('api', () => {
      const cfg = loadConfig({
        NODE_ENDPOINT: 'https://node.example',
        NETWORK: 'mainnet',
        PREDETERMINED_LEVEL: '2',
        AUTH_SCHEME: 'apiKey',
        AUTH_CREDENTIALS: 'k',
        RATE_LIMIT_PER_MINUTE: '10',
        LOG_LEVEL: 'error',
      });
      assert(cfg.ok, 'config did not load');
      if (cfg.ok) {
        const app = createApp({
          config: cfg.value,
          headerChain: new HeaderChain(),
          proofStore: new ProofStore(2),
          auditLog: new AuditLog(),
          logger: new Logger('error', { write() {} }),
          now: () => 0,
        });
        assert(app.handle({ method: 'GET', path: '/healthz', headers: {}, body: undefined }).status === 200, 'healthz failed');
        const anchored = app.handle({ method: 'POST', path: '/anchor', headers: { 'x-api-key': 'k' }, body: { accountingTransaction: { kind: 'invoice', fields: [{ tag: 'a', valueHex: '00' }] } } });
        assert(anchored.status === 200, 'anchor endpoint failed');
      }
      return 'config, auth, health, and the anchor endpoint respond';
    }),
  );

  results.push(
    runLayer('studies', () => {
      const s = measureStorage(STORAGE_SEED, 256);
      assert(s.shardedStoredBytes <= s.baselineFullProofBytes, 'sharded exceeded baseline');
      const a = measureAssurance(ASSURANCE_SEED, CI_M);
      assert(a.rollForwardOk && a.cleanFalsePositives === 0, 'assurance clean checks failed');
      assert(a.faults.every((f) => f.detected === 1), 'a fault class was missed');
      assert(a.falseOriginDetected === false, 'false-origin boundary not honoured');
      return 'storage and assurance studies pass their CI checks';
    }),
  );

  let allOk = true;
  for (const r of results) {
    process.stdout.write(`${r.ok ? 'PASS' : 'FAIL'} ${r.layer}: ${r.detail}\n`);
    if (!r.ok) allOk = false;
  }
  process.stdout.write(allOk ? 'selftest: all layers passed\n' : 'selftest: a layer failed\n');
  return allOk ? 0 : 1;
}
