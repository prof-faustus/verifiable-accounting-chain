// The deterministic link relation (EP3259724B1). Each link key is a function of
// the PKI root and of every preceding transaction's identity and committed
// fields, so reordering/inserting/removing a link breaks every subsequent key.
import type { Txid, Hash, Scalar, Point } from '@vaa/bsv';
import {
  doubleSha256,
  concat,
  reduceHash,
  scalarAdd,
  pointAdd,
  pointMulG,
  TxidOps,
  HashOps,
} from '@vaa/bsv';

export function u32be(n: number): Uint8Array {
  return Uint8Array.of((n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
}

// M_i = doubleSha256( T_{i-1} ‖ R_{i-1} ‖ R_i ) — binds i to i-1 and to i's fields.
export function linkMessage(prevTxid: Txid, prevFieldRoot: Hash, fieldRoot: Hash): Hash {
  return doubleSha256(concat(TxidOps.toInternalBytes(prevTxid), HashOps.toInternalBytes(prevFieldRoot), HashOps.toInternalBytes(fieldRoot)));
}

// genesisMsg identifies the entity/period; the head is bound to the PKI root.
export function genesisMessage(entityId: Uint8Array, periodId: Uint8Array): Hash {
  return doubleSha256(concat(entityId, periodId));
}

export function deriveHeadPub(rootPub: Point, genesisMsg: Hash): Point {
  return pointAdd(rootPub, pointMulG(reduceHash(genesisMsg)));
}
export function deriveHeadPriv(rootPriv: Scalar, genesisMsg: Hash): Scalar {
  return scalarAdd(rootPriv, reduceHash(genesisMsg));
}
export function deriveNextPub(prevLinkPub: Point, m: Hash): Point {
  return pointAdd(prevLinkPub, pointMulG(reduceHash(m)));
}
export function deriveNextPriv(prevLinkPriv: Scalar, m: Hash): Scalar {
  return scalarAdd(prevLinkPriv, reduceHash(m));
}

// The per-link signed portion: includes the index and the field-root indication.
export function linkSignedMessage(index: number, txid: Txid, fieldRoot: Hash): Uint8Array {
  return doubleSha256(concat(u32be(index), TxidOps.toInternalBytes(txid), HashOps.toInternalBytes(fieldRoot)));
}
