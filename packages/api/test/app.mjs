// Test harness: a ready AppContext with a populated proof store and a synthetic
// header chain that anchors the store's root.
//
// The header here is a SYNTHETIC test double for the header-chain interface (it
// uses an easy target so its hash meets target without mining). It is not, and is
// not presented as, genuine BSV block data — the genuine-block anchoring path is
// covered by the merkle e2e test against real block 181.
import { HashOps, TxidOps, hashLeaf, HeaderChain, meetsTarget } from '@vaa/bsv';
import { computeRoot, merkleProof } from '@vaa/merkle';
import { ProofStore } from '@vaa/proofstore';
import { loadConfig, Logger, AuditLog, createApp } from '@vaa/api';

export function makeLeaves(seed, n) {
  let s = seed >>> 0;
  const out = [];
  for (let i = 0; i < n; i++) {
    s = (s + 0x9e3779b9) >>> 0;
    const b = new Uint8Array(8);
    for (let j = 0; j < 8; j++) {
      s = Math.imul(s ^ (s >>> 13), 0x5bd1e995) >>> 0;
      b[j] = s & 0xff;
    }
    out.push(hashLeaf(b));
  }
  return out;
}

export function makeKey(i) {
  const t = new Uint8Array(32);
  t[0] = i & 0xff;
  t[1] = (i >> 8) & 0xff;
  return { txid: TxidOps.fromInternalBytes(t).value, direction: 'output', position: i, blockPosition: i };
}

export function keyJson(k) {
  return { txidHex: TxidOps.toDisplayHex(k.txid), direction: k.direction, position: k.position, blockPosition: k.blockPosition };
}

function syntheticHeaderFor(root) {
  let header = { version: 1, prevBlockHash: HashOps.zero(), merkleRoot: root, time: 0, bits: 0x2100ffff, nonce: 0 };
  let guard = 0;
  while (!meetsTarget(header) && guard < 1_000_000) {
    header = { ...header, nonce: header.nonce + 1 };
    guard++;
  }
  return header;
}

export const VALID_KEY = 'secret-key';

export function buildContext(opts = {}) {
  const n = opts.n ?? 32;
  const perMinute = opts.perMinute ?? 5;
  const env = {
    NODE_ENDPOINT: 'https://node.example/v1/bsv/main',
    NETWORK: 'mainnet',
    PREDETERMINED_LEVEL: '2',
    AUTH_SCHEME: 'apiKey',
    AUTH_CREDENTIALS: VALID_KEY,
    RATE_LIMIT_PER_MINUTE: String(perMinute),
    LOG_LEVEL: 'error',
  };
  const config = loadConfig(env);
  if (!config.ok) throw new Error('config did not load: ' + JSON.stringify(config.error));

  const leaves = makeLeaves(100, n);
  const store = new ProofStore(2);
  const keys = [];
  for (let i = 0; i < n; i++) {
    const k = makeKey(i);
    keys.push(k);
    const r = store.anchor(k, leaves, i);
    if (!r.ok) throw new Error('anchor failed: ' + JSON.stringify(r.error));
  }
  const root = computeRoot(leaves).value;

  const chain = new HeaderChain();
  const added = chain.add(syntheticHeaderFor(root));
  if (!added.ok) throw new Error('synthetic header did not anchor: ' + JSON.stringify(added.error));

  const clock = { t: 1_000_000 };
  const ctx = {
    config: config.value,
    headerChain: chain,
    proofStore: store,
    auditLog: new AuditLog(),
    logger: new Logger('error', { write() {} }),
    now: () => clock.t,
  };
  const app = createApp(ctx);
  return { app, ctx, leaves, keys, root, store, clock, config: config.value };
}

export function authHeaders() {
  return { 'x-api-key': VALID_KEY };
}

export function proofSiblingsHex(leaves, index) {
  return merkleProof(leaves, index).value.siblings.map((h) => HashOps.toDisplayHex(h));
}

export function leavesHex(leaves) {
  return leaves.map((h) => HashOps.toDisplayHex(h));
}

export function rootHexOf(root) {
  return HashOps.toDisplayHex(root);
}
