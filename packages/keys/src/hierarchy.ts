// The general-ledger key hierarchy under the PKI root (EP3420669B1). Every
// ledger node (and every field) has a deterministic key derived by folding the
// child-derivation over its path segments from the root.
import type { Scalar, Point, VerifyResult, Result } from '@vaa/bsv';
import {
  ok,
  err,
  doubleSha256,
  reduceHash,
  scalarIsZero,
  pointMulG,
  pointEq,
  verifyOk,
  verifyFail,
} from '@vaa/bsv';
import type { KeysError, KeysVerifyReason } from './errors.js';
import { derivePrivChild, derivePubChild } from './derive.js';
import { badPathSegment, derivationOutOfRange } from './errors.js';

export type LedgerPath = string[];

export interface RootKeyPair {
  rootPriv: Scalar;
  rootPub: Point;
}

// A pluggable provider for a real (e.g. HSM-held) root. The test/default path
// derives the root deterministically from a seed.
export interface RootProvider {
  rootKeyPair(): RootKeyPair;
}

export function rootFromSeed(seed: Uint8Array): RootKeyPair {
  // Documented derivation: rootPriv = H(seed) mod n (non-zero); rootPub = rootPriv·G.
  let rootPriv = reduceHash(doubleSha256(seed));
  if (scalarIsZero(rootPriv)) rootPriv = reduceHash(doubleSha256(doubleSha256(seed)));
  return { rootPriv, rootPub: pointMulG(rootPriv) };
}

export function seededRootProvider(seed: Uint8Array): RootProvider {
  const pair = rootFromSeed(seed);
  return { rootKeyPair: () => pair };
}

const enc = new TextEncoder();

function checkSegments(path: LedgerPath): KeysError | undefined {
  for (const seg of path) if (seg.length === 0) return badPathSegment(seg);
  return undefined;
}

export function derivePathPub(rootPub: Point, path: LedgerPath): Result<Point, KeysError> {
  const bad = checkSegments(path);
  if (bad !== undefined) return err(bad);
  let acc = rootPub;
  for (const seg of path) acc = derivePubChild(acc, enc.encode(seg));
  return ok(acc);
}

export function derivePathPriv(rootPriv: Scalar, path: LedgerPath): Result<Scalar, KeysError> {
  const bad = checkSegments(path);
  if (bad !== undefined) return err(bad);
  let acc = rootPriv;
  for (const seg of path) {
    const child = derivePrivChild(acc, enc.encode(seg));
    if (!child.ok) return err(derivationOutOfRange());
    acc = child.value;
  }
  return ok(acc);
}

// The field's root-anchored key identity.
export function nodeKeyFor(rootPub: Point, path: LedgerPath): Result<Point, KeysError> {
  return derivePathPub(rootPub, path);
}

export function verifyNodeUnderRoot(rootPub: Point, path: LedgerPath, claimedPub: Point): VerifyResult<KeysVerifyReason> {
  const derived = derivePathPub(rootPub, path);
  if (!derived.ok) return verifyFail({ kind: 'NotUnderRoot' });
  if (!pointEq(derived.value, claimedPub)) return verifyFail({ kind: 'NotUnderRoot' });
  return verifyOk();
}
