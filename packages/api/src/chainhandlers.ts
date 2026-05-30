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

// A single-period in-memory chain with server-side signing from the PKI root.
export class ChainService implements ChainBackend {
  private readonly rootProvider: RootProvider;
  private readonly genesisMsg: Hash;
  private readonly chain: TransactionChain;
  private runningPriv: Scalar = 0n;
  private lastTxid: Txid | undefined;
  private lastFieldRoot: Hash | undefined;

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

  append(txid: Txid, fieldRoot: Hash, prevVout: number | undefined): Result<{ index: number; linkPubHex: string; signatureHex: string }, ApiError> {
    const index = this.chain.links().length;
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
    this.runningPriv = priv;
    this.lastTxid = txid;
    this.lastFieldRoot = fieldRoot;
    return ok({ index: r.value.index, linkPubHex: pointToHex(r.value.linkPub), signatureHex: toHexLower(r.value.signature) });
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
