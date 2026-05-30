// The four operations. verify uses ONLY the adversarial / proof-assistance path
// and terminates in the BSV header chain; it refuses any trusted-operational
// result.
import type { Result } from '@vaa/bsv';
import { HashOps, TxidOps, ScriptOps, ok, err } from '@vaa/bsv';
import type { HeaderChain } from '@vaa/bsv';
import { merkleProof, computeRoot, proveAgainstChain } from '@vaa/merkle';
import type { ProofStore, StoredProof, IndexKey } from '@vaa/proofstore';
import { serializeKey } from '@vaa/proofstore';
import { buildAccountingTx } from '@vaa/evidence';
import type { AppConfig } from './config.js';
import type { AuditLog } from './auditlog.js';
import type { Logger } from './logger.js';
import type { ApiError } from './errors.js';
import { badRequest, notFound, internal } from './errors.js';
import type { ParsedAnchor, ParsedProve, ParsedQuery, ParsedVerify } from './schemas.js';

export interface AppContext {
  config: AppConfig;
  headerChain: HeaderChain;
  proofStore: ProofStore;
  auditLog: AuditLog;
  logger: Logger;
  now: () => number;
}

export type VerifyOutcome = { ok: true } | { ok: false; reason: { kind: string } };

interface IndexKeyJson {
  txidHex: string;
  direction: 'input' | 'output';
  position: number;
  blockPosition: number;
  lockingScriptHex?: string;
  unlockingScriptHex?: string;
  amountMinorUnits?: string;
}

function indexKeyToJson(k: IndexKey): IndexKeyJson {
  const j: IndexKeyJson = {
    txidHex: TxidOps.toDisplayHex(k.txid),
    direction: k.direction,
    position: k.position,
    blockPosition: k.blockPosition,
  };
  if (k.lockingScript !== undefined) j.lockingScriptHex = ScriptOps.toHex(k.lockingScript);
  if (k.unlockingScript !== undefined) j.unlockingScriptHex = ScriptOps.toHex(k.unlockingScript);
  if (k.amountMinorUnits !== undefined) j.amountMinorUnits = k.amountMinorUnits.toString();
  return j;
}

export interface StoredProofJson {
  key: IndexKeyJson;
  leafIndex: number;
  shards: { fromLevel: number; toLevel: number; siblingsHex: string[] }[];
  expectedRootHex: string;
}

function storedProofToJson(s: StoredProof): StoredProofJson {
  return {
    key: indexKeyToJson(s.key),
    leafIndex: s.leafIndex,
    shards: s.shards.map((sh) => ({
      fromLevel: sh.fromLevel,
      toLevel: sh.toLevel,
      siblingsHex: sh.siblings.map((h) => HashOps.toDisplayHex(h)),
    })),
    expectedRootHex: HashOps.toDisplayHex(s.expectedRoot),
  };
}

export function anchor(parsed: ParsedAnchor, _ctx: AppContext): Result<{ fieldTreeRootHex: string; envelopeScriptsHex: string[] }, ApiError> {
  const built = buildAccountingTx(parsed.tx);
  if (!built.ok) return err(badRequest('accountingTransaction', built.error.message));
  return ok({
    fieldTreeRootHex: HashOps.toDisplayHex(built.value.fieldTreeRoot),
    envelopeScriptsHex: built.value.lockingScripts.map((s) => ScriptOps.toHex(s)),
  });
}

export function prove(parsed: ParsedProve, _ctx: AppContext): Result<{ proof: { index: number; siblingsDisplayHex: string[] }; rootDisplayHex: string }, ApiError> {
  const proof = merkleProof(parsed.leaves, parsed.index);
  if (!proof.ok) return err(badRequest('index', proof.error.message));
  const root = computeRoot(parsed.leaves);
  if (!root.ok) return err(internal(root.error.message));
  return ok({
    proof: { index: proof.value.index, siblingsDisplayHex: proof.value.siblings.map((h) => HashOps.toDisplayHex(h)) },
    rootDisplayHex: HashOps.toDisplayHex(root.value),
  });
}

export function query(parsed: ParsedQuery, ctx: AppContext, callerId: string): Result<{ storedProof: StoredProofJson }, ApiError> {
  const res = ctx.proofStore.query(parsed.key);
  const keyHex = serializeKey(parsed.key);
  if (!res.ok) {
    ctx.auditLog.record({ ts: new Date(ctx.now()).toISOString(), callerId, queryKeyHex: keyHex, returnedFragmentId: '-', outcome: 'not_found' });
    return err(notFound(`proof for key`));
  }
  const json = storedProofToJson(res.value);
  // Audit metadata only — never record content.
  ctx.auditLog.record({
    ts: new Date(ctx.now()).toISOString(),
    callerId,
    queryKeyHex: keyHex,
    returnedFragmentId: `${json.expectedRootHex.slice(0, 16)}:${json.leafIndex}`,
    outcome: 'served',
  });
  return ok({ storedProof: json });
}

export function verify(parsed: ParsedVerify, ctx: AppContext): Result<VerifyOutcome, ApiError> {
  // The audit path: proofstore.verify in adversarial mode (it refuses
  // trustedOperational), then proveAgainstChain terminating in the header chain.
  const v1 = ctx.proofStore.verify(parsed.leaf, parsed.stored, parsed.mode);
  if (!v1.ok) return ok({ ok: false, reason: v1.reason });
  const v2 = proveAgainstChain(parsed.leaf, parsed.proof, parsed.root, ctx.headerChain);
  if (v2.ok) return ok({ ok: true });
  return ok({ ok: false, reason: v2.reason });
}
