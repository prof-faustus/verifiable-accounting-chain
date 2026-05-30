// selftest -> exercise every layer end to end and report pass/fail per layer.
import { join } from 'node:path';
import { HashOps, TxidOps, HeaderChain, headerHash } from '@vaa/bsv';
import type { Hash, BlockHeader, Txid } from '@vaa/bsv';
import { computeRoot } from '@vaa/merkle';
import { ProofStore } from '@vaa/proofstore';
import type { IndexKey } from '@vaa/proofstore';
import { bigInvoiceTransaction, discloseField, verifyDisclosedField, checkInvoiceTotal } from '@vaa/evidence';
import { loadConfig, createApp, AuditLog, Logger } from '@vaa/api';
import { measureStorage, SEED as STORAGE_SEED, deterministicLeaves } from '@vaa/simstore';
import { measureAssurance, SEED as ASSURANCE_SEED, CI_M } from '@vaa/simstudy';
import { readJsonFile, repoRoot, must } from './args.js';

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
      if (d.ok) assert(verifyDisclosedField(d.value.field, d.value.proof, d.value.root).ok, 'disclosed field did not verify');
      assert(checkInvoiceTotal({ type: 'invoice', id: 'i', counterparty: 'c', net: 100n, tax: 21n, discount: 1n, gross: 120n }).ok, 'invoice total check failed');
      return 'field tree, per-field disclosure, and recomputation check hold';
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
