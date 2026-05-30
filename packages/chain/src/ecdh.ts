// The ECDH common secret (EP3259724B1), for controlled point-to-point delivery
// of a bundle to a specific auditor key. NOT audit evidence and never hides the
// audited values from the auditor.
import type { Scalar, Point } from '@vaa/bsv';
import { doubleSha256, reduceHash, scalarAdd, pointAdd, pointMul, pointMulG } from '@vaa/bsv';

export function commonSecret(myMasterPriv: Scalar, theirMasterPub: Point, m: Uint8Array): Point {
  const gv = reduceHash(doubleSha256(m));
  const myV2 = scalarAdd(myMasterPriv, gv);
  const theirV2Pub = pointAdd(theirMasterPub, pointMulG(gv));
  return pointMul(theirV2Pub, myV2);
}
