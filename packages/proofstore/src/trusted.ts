// Trusted-operational compression (Selective Verification claims 9-11). OPTIONAL,
// OFF BY DEFAULT, and NEVER accepted by the audit path.
//
// A function with a homomorphic property over the proof-assistance node labels,
// realised as a sum of points on secp256k1 (Bitcoin's curve, the BSV curve) via
// the SDK: each node label at the predetermined level becomes a scalar, and the
// commitment is the sum of scalar*G. Because the sum is additively homomorphic in
// the scalars it is cheap to combine, but it is easier to manipulate than
// adversarial Merkle reconstruction and is therefore NOT adversarially sound.
import { Curve, BigNumber } from '@bsv/sdk';
import type { Hash, VerifyResult } from '@vaa/bsv';
import { HashOps, verifyOk, verifyFail } from '@vaa/bsv';
import type { TrustedVerifyReason } from './errors.js';

interface CurvePoint {
  add(other: CurvePoint): CurvePoint;
  encode(compact: boolean, enc: 'hex'): string;
}

function labelScalar(curve: Curve, label: Hash): BigNumber {
  const hex = HashOps.toDisplayHex(label); // 32-byte big-endian numeric view
  const s = new BigNumber(hex, 16).umod(curve.n);
  // Avoid the identity element so every label contributes a real point.
  return s.isZero() ? new BigNumber(1) : s;
}

// The homomorphic commitment to a set of node labels, as a compressed point hex.
export function homomorphicCommitment(labels: Hash[]): string {
  const curve = new Curve();
  const g = curve.g as unknown as { mul(s: BigNumber): CurvePoint };
  let acc: CurvePoint | undefined;
  for (const label of labels) {
    const point = g.mul(labelScalar(curve, label));
    acc = acc === undefined ? point : acc.add(point);
  }
  if (acc === undefined) {
    // No labels: the empty sum is the identity; encode the base point times zero
    // is the point at infinity, which the SDK encodes deterministically.
    return (g.mul(new BigNumber(0)) as CurvePoint).encode(true, 'hex');
  }
  return acc.encode(true, 'hex');
}

// Trusted-only check: recompute the commitment and compare. Not audit evidence.
export function verifyTrustedOperational(
  labels: Hash[],
  expectedCommitmentHex: string,
): VerifyResult<TrustedVerifyReason> {
  if (homomorphicCommitment(labels) === expectedCommitmentHex) return verifyOk();
  return verifyFail({ kind: 'TrustedSumMismatch' });
}
