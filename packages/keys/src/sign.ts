// PKI attestations and per-link signatures: ECDSA over the BSV curve (low-S) via
// the SDK. A Signature is its DER encoding (so it serialises into the on-chain
// CHAIN-LINK / PKI-ATTEST items).
import { PrivateKey, PublicKey, Signature as SdkSignature } from '@bsv/sdk';
import type { Scalar, Point, VerifyResult } from '@vaa/bsv';
import { pointToHex, CURVE_N, verifyOk, verifyFail } from '@vaa/bsv';
import type { KeysVerifyReason } from './errors.js';

export type Sig = Uint8Array; // DER encoding

function scalarHex(s: Scalar): string {
  return s.toString(16).padStart(64, '0');
}

export function sign(priv: Scalar, message: Uint8Array): Sig {
  const pk = PrivateKey.fromString(scalarHex(priv), 16);
  const sig = pk.sign(Array.from(message));
  return Uint8Array.from(sig.toDER() as number[]);
}

export function verify(pub: Point, message: Uint8Array, sig: Sig): VerifyResult<KeysVerifyReason> {
  try {
    const pk = PublicKey.fromString(pointToHex(pub));
    const signature = SdkSignature.fromDER(Array.from(sig));
    return pk.verify(Array.from(message), signature) ? verifyOk() : verifyFail({ kind: 'BadSignature' });
  } catch {
    return verifyFail({ kind: 'BadSignature' });
  }
}

export function isLowS(sig: Sig): boolean {
  try {
    const s = BigInt(SdkSignature.fromDER(Array.from(sig)).s.toString());
    return s <= CURVE_N / 2n;
  } catch {
    return false;
  }
}

export function attestStructure(rootPriv: Scalar, structureDigest: Uint8Array): Sig {
  return sign(rootPriv, structureDigest);
}

export function verifyAttestation(rootPub: Point, structureDigest: Uint8Array, sig: Sig): VerifyResult<KeysVerifyReason> {
  return verify(rootPub, structureDigest, sig);
}
