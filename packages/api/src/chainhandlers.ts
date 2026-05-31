// Chain (Pillar 2) and bundle operations: /chain/append, /chain/verify,
// /bundle/issue, /bundle/verify. bundle/verify uses only the adversarial path and
// terminates in the BSV header chain.
import type { Result, Txid, Hash, Scalar } from '@vaa/bsv';
import { HashOps, TxidOps, pointToHex, toHexLower, ok, err } from '@vaa/bsv';
import { rootFromSeed, sign as keysSign } from '@vaa/keys';
import type { RootProvider } from '@vaa/keys';
import { TransactionChain, genesisMessage, deriveHeadPriv, deriveNextPriv, linkMessage } from '@vaa/chain';
import { issueBundle, verifyBundle } from '@vaa/bundle';
import type { MerkleProof } from '@vaa/merkle';
import type { ApiError } from './errors.js';
import { badRequest, notFound } from './errors.js';
import type { AppContext, ChainBackend, VerifyOutcome } from './handlers.js';
import { parseAnchorRequest } from './schemas.js';
import { bundleToJson, bundleFromJson } from './bundlecodec.js';

// One appended record (the replay log): the inputs that deterministically
// reproduce a link. Signing is deterministic (RFC6979), so replaying these
// rebuilds a byte-identical, verifying chain.
export interface ChainRecord {
  txidHex: string;
  fieldRootHex: string;
  prevVout?: number;
}

// A single-period chain with server-side signing from the PKI root. Robustness:
// appends are atomic and guarded against re-entrancy; a txid may appear at most
// once; the chain length is bounded; and the full input log can be snapshotted
// and replayed to recover the chain across a restart.
export class ChainService implements ChainBackend {
  static readonly MAX_LINKS = 1_000_000;

  private readonly rootProvider: RootProvider;
  private readonly genesisMsg: Hash;
  private readonly chain: TransactionChain;
  private runningPriv: Scalar = 0n;
  private lastTxid: Txid | undefined;
  private lastFieldRoot: Hash | undefined;
  private readonly seenTxids = new Set<string>();
  private readonly records: ChainRecord[] = [];
  private appending = false;

  constructor(seed: Uint8Array, entityId: Uint8Array, periodId: Uint8Array) {
    this.rootProvider = { rootKeyPair: () => rootFromSeed(seed) };
    this.genesisMsg = genesisMessage(entityId, periodId);
    this.chain = new TransactionChain(this.rootProvider.rootKeyPair().rootPub, this.genesisMsg);
  }

  rootPubPoint() {
    return this.rootProvider.rootKeyPair().rootPub;
  }
  genesis(): Hash {
    return this.genesisMsg;
  }
  getChain(): TransactionChain {
    return this.chain;
  }
  length(): number {
    return this.chain.links().length;
  }

  // The replay log of appended inputs (for persistence / recovery).
  snapshot(): ChainRecord[] {
    return this.records.map((r) => ({ ...r }));
  }

  // Rebuild a chain by replaying a snapshot's inputs against the same root.
  static replay(seed: Uint8Array, entityId: Uint8Array, periodId: Uint8Array, records: ChainRecord[]): Result<ChainService, ApiError> {
    const svc = new ChainService(seed, entityId, periodId);
    for (const rec of records) {
      const txid = TxidOps.fromDisplayHex(rec.txidHex);
      const fieldRoot = HashOps.fromDisplayHex(rec.fieldRootHex);
      if (!txid.ok) return err(badRequest('snapshot.txidHex', 'invalid'));
      if (!fieldRoot.ok) return err(badRequest('snapshot.fieldRootHex', 'invalid'));
      const r = svc.append(txid.value, fieldRoot.value, rec.prevVout);
      if (!r.ok) return err(r.error);
    }
    return ok(svc);
  }

  append(txid: Txid, fieldRoot: Hash, prevVout: number | undefined): Result<{ index: number; linkPubHex: string; signatureHex: string }, ApiError> {
    if (this.appending) return err(badRequest('chain', 're-entrant append'));
    const index = this.chain.links().length;
    if (index >= ChainService.MAX_LINKS) return err(badRequest('chain', 'chain length bound reached'));
    const txidHex = TxidOps.toDisplayHex(txid);
    if (this.seenTxids.has(txidHex)) return err(badRequest('chain', 'duplicate txid'));
    if (prevVout !== undefined && (!Number.isInteger(prevVout) || prevVout < 0)) return err(badRequest('prevVout', 'must be a non-negative integer'));

    this.appending = true;
    try {
      const { rootPriv } = this.rootProvider.rootKeyPair();
      let priv: Scalar;
      let prevOutpoint: { txid: Txid; vout: number } | undefined;
      if (index === 0) {
        priv = deriveHeadPriv(rootPriv, this.genesisMsg);
        prevOutpoint = undefined;
      } else {
        if (this.lastTxid === undefined || this.lastFieldRoot === undefined) return err(badRequest('chain', 'no predecessor'));
        priv = deriveNextPriv(this.runningPriv, linkMessage(this.lastTxid, this.lastFieldRoot, fieldRoot));
        prevOutpoint = { txid: this.lastTxid, vout: prevVout ?? 0 };
      }
      const r = this.chain.append(txid, fieldRoot, prevOutpoint, (_i, m) => keysSign(priv, m));
      if (!r.ok) return err(badRequest('chain', r.error.kind));
      // commit the new state only after a successful append
      this.runningPriv = priv;
      this.lastTxid = txid;
      this.lastFieldRoot = fieldRoot;
      this.seenTxids.add(txidHex);
      const rec: ChainRecord = { txidHex, fieldRootHex: HashOps.toDisplayHex(fieldRoot) };
      if (prevVout !== undefined) rec.prevVout = prevVout;
      this.records.push(rec);
      return ok({ index: r.value.index, linkPubHex: pointToHex(r.value.linkPub), signatureHex: toHexLower(r.value.signature) });
    } finally {
      this.appending = false;
    }
  }

  verify(): VerifyOutcome {
    const v = this.chain.verifyChain();
    return v.ok ? { ok: true } : { ok: false, reason: v.reason };
  }
}

function obj(x: unknown): Record<string, unknown> | undefined {
  return typeof x === 'object' && x !== null && !Array.isArray(x) ? (x as Record<string, unknown>) : undefined;
}

export function chainAppend(body: unknown, ctx: AppContext): Result<{ index: number; linkPubHex: string; signatureHex: string }, ApiError> {
  if (ctx.chainBackend === undefined) return err(notFound('chain service'));
  const o = obj(body);
  if (o === undefined) return err(badRequest('body', 'must be an object'));
  const txid = typeof o['txidHex'] === 'string' ? TxidOps.fromDisplayHex(o['txidHex']) : undefined;
  const fieldRoot = typeof o['fieldRootHex'] === 'string' ? HashOps.fromDisplayHex(o['fieldRootHex']) : undefined;
  if (txid === undefined || !txid.ok) return err(badRequest('txidHex', 'must be a txid hex'));
  if (fieldRoot === undefined || !fieldRoot.ok) return err(badRequest('fieldRootHex', 'must be a 32-byte hex'));
  const prevVout = typeof o['prevVout'] === 'number' ? o['prevVout'] : undefined;
  return ctx.chainBackend.append(txid.value, fieldRoot.value, prevVout);
}

export function chainVerify(ctx: AppContext): Result<VerifyOutcome, ApiError> {
  if (ctx.chainBackend === undefined) return err(notFound('chain service'));
  return ok(ctx.chainBackend.verify());
}

export function bundleIssue(body: unknown, ctx: AppContext): Result<{ bundle: Record<string, unknown> }, ApiError> {
  if (ctx.chainBackend === undefined) return err(notFound('chain service'));
  const o = obj(body);
  if (o === undefined) return err(badRequest('body', 'must be an object'));
  const parsedTx = parseAnchorRequest({ accountingTransaction: o['accountingTransaction'] });
  if (!parsedTx.ok) return err(parsedTx.error);
  if (!Array.isArray(o['fieldIndices'])) return err(badRequest('fieldIndices', 'must be an array'));
  const fieldIndices: number[] = [];
  for (const idx of o['fieldIndices']) {
    if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0) return err(badRequest('fieldIndices', 'must be non-negative integers'));
    fieldIndices.push(idx);
  }
  if (typeof o['chainIndex'] !== 'number') return err(badRequest('chainIndex', 'must be a number'));
  const inc = obj(o['inclusion']);
  const incTxid = typeof inc?.['txidHex'] === 'string' ? TxidOps.fromDisplayHex(inc['txidHex'] as string) : undefined;
  if (inc === undefined || incTxid === undefined || !incTxid.ok) return err(badRequest('inclusion', 'must contain txidHex'));
  const incPath = obj(inc['merklePath']);
  if (incPath === undefined || typeof incPath['index'] !== 'number' || !Array.isArray(incPath['siblingsHex'])) return err(badRequest('inclusion.merklePath', 'bad'));
  const siblings: Hash[] = [];
  for (const s of incPath['siblingsHex']) {
    const h = typeof s === 'string' ? HashOps.fromDisplayHex(s) : undefined;
    if (h === undefined || !h.ok) return err(badRequest('inclusion.merklePath.siblingsHex', 'bad hash'));
    siblings.push(h.value);
  }
  const merklePath: MerkleProof = { index: incPath['index'], siblings };
  const issued = issueBundle(parsedTx.value.tx, fieldIndices, ctx.chainBackend.getChain(), o['chainIndex'], { inclusion: { txid: incTxid.value, merklePath } });
  if (!issued.ok) return err(badRequest('bundle', issued.error.kind));
  return ok({ bundle: bundleToJson(issued.value) });
}

export function bundleVerify(body: unknown, ctx: AppContext): Result<VerifyOutcome, ApiError> {
  if (ctx.rootPub === undefined || ctx.genesisMsg === undefined) return err(notFound('chain root context'));
  const o = obj(body);
  if (o === undefined) return err(badRequest('body', 'must be an object'));
  const decoded = bundleFromJson(o['bundle']);
  if (!decoded.ok) return err(badRequest('bundle', decoded.error));
  const v = verifyBundle(ctx.rootPub, ctx.genesisMsg, ctx.headerChain, decoded.value);
  return ok(v.ok ? { ok: true } : { ok: false, reason: v.reason });
}
