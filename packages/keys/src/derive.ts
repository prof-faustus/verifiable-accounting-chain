// Deterministic key derivation (EP3259724B1 mechanism), on the BSV curve.
// child = parent + H(segment) ; the public side matches the private side because
// childPub = parentPub + H(segment)·G and childPub == childPriv·G.
import type { Scalar, Point, Result } from '@vaa/bsv';
import { ok, err, doubleSha256, reduceHash, scalarAdd, scalarIsZero, pointAdd, pointMulG } from '@vaa/bsv';
import type { KeysError } from './errors.js';
import { derivationOutOfRange } from './errors.js';

// Generator value for a segment: H(segment) reduced mod n (EP3259724B1: GV = hash of a message).
export function generatorValue(segment: Uint8Array): Scalar {
  return reduceHash(doubleSha256(segment));
}

export function derivePrivChild(parentPriv: Scalar, segment: Uint8Array): Result<Scalar, KeysError> {
  const gv = generatorValue(segment);
  const child = scalarAdd(parentPriv, gv);
  if (scalarIsZero(child)) return err(derivationOutOfRange());
  return ok(child);
}

export function derivePubChild(parentPub: Point, segment: Uint8Array): Point {
  const gv = generatorValue(segment);
  return pointAdd(parentPub, pointMulG(gv));
}
