// The provable transaction chain: spend-link (US12375287B2) + deterministic key
// series (EP3259724B1) + per-link signatures. Rooted at the PKI key.
import type { Txid, Hash, Point, Result, VerifyResult } from '@vaa/bsv';
import { TxidOps, pointEq, verifyOk, verifyFail, ok, err } from '@vaa/bsv';
import type { Sig } from '@vaa/keys';
import { verify as keysVerify } from '@vaa/keys';
import type { ChainError, ChainVerifyReason } from './errors.js';
import { brokenLink, linkOutOfOrder, badChainProof } from './errors.js';
import { deriveHeadPub, deriveNextPub, linkMessage, linkSignedMessage } from './link.js';

export interface Outpoint {
  txid: Txid;
  vout: number;
}

export interface Link {
  index: number;
  txid: Txid;
  fieldRoot: Hash;
  linkPub: Point;
  prevOutpoint?: Outpoint;
  signature: Sig;
}

export interface ChainLinkProof {
  index: number;
  txid: Txid;
  fieldRoot: Hash;
  linkPub: Point;
  signature: Sig;
  prevTxid?: Txid;
  prevFieldRoot?: Hash;
  prevOutpoint?: Outpoint;
  prevLinkPub?: Point;
}

// signFn signs the link's signed portion under the key for this index (it wraps
// keys.sign with the link's private key); the chain never holds private keys.
export type SignLink = (index: number, message: Uint8Array) => Sig;

export class TransactionChain {
  private readonly headPub: Point;
  private readonly linksList: Link[] = [];

  constructor(rootPub: Point, genesisMsg: Hash) {
    this.headPub = deriveHeadPub(rootPub, genesisMsg);
  }

  links(): readonly Link[] {
    return this.linksList;
  }

  head(): Point {
    return this.headPub;
  }

  append(txid: Txid, fieldRoot: Hash, prevOutpoint: Outpoint | undefined, signFn: SignLink): Result<Link, ChainError> {
    const index = this.linksList.length;
    let linkPub: Point;
    if (index === 0) {
      linkPub = this.headPub;
    } else {
      const prev = this.linksList[index - 1] as Link;
      if (prevOutpoint === undefined) return err(linkOutOfOrder(index - 1, -1));
      if (!TxidOps.equals(prevOutpoint.txid, prev.txid)) {
        return err(brokenLink(index));
      }
      linkPub = deriveNextPub(prev.linkPub, linkMessage(prev.txid, prev.fieldRoot, fieldRoot));
    }
    const signature = signFn(index, linkSignedMessage(index, txid, fieldRoot));
    const link: Link = { index, txid, fieldRoot, linkPub, signature };
    if (prevOutpoint !== undefined) link.prevOutpoint = prevOutpoint;
    this.linksList.push(link);
    return ok(link);
  }

  verifyChain(): VerifyResult<ChainVerifyReason> {
    return verifyLinks(this.headPub, this.linksList);
  }

  // Minimal evidence binding `index` into the chain without revealing other
  // transactions' field VALUES (only the predecessor's txid and committed ROOT).
  linkProof(index: number): Result<ChainLinkProof, ChainError> {
    const link = this.linksList[index];
    if (link === undefined) return err(badChainProof('index out of range'));
    const proof: ChainLinkProof = {
      index: link.index,
      txid: link.txid,
      fieldRoot: link.fieldRoot,
      linkPub: link.linkPub,
      signature: link.signature,
    };
    if (index > 0) {
      const prev = this.linksList[index - 1] as Link;
      proof.prevTxid = prev.txid;
      proof.prevFieldRoot = prev.fieldRoot;
      proof.prevLinkPub = prev.linkPub;
      if (link.prevOutpoint !== undefined) proof.prevOutpoint = link.prevOutpoint;
    }
    return ok(proof);
  }
}

// Verify a sequence of links against the chain head. Recomputes every linkPub
// forward, checks the spend-link, and checks each per-link signature.
export function verifyLinks(headPub: Point, links: readonly Link[]): VerifyResult<ChainVerifyReason> {
  for (let i = 0; i < links.length; i++) {
    const link = links[i] as Link;
    if (i === 0) {
      if (!pointEq(link.linkPub, headPub)) return verifyFail({ kind: 'NotRootedAtPki' });
    } else {
      const prev = links[i - 1] as Link;
      const expected = deriveNextPub(prev.linkPub, linkMessage(prev.txid, prev.fieldRoot, link.fieldRoot));
      if (!pointEq(link.linkPub, expected)) return verifyFail({ kind: 'BrokenLink', atIndex: i });
      if (link.prevOutpoint === undefined || !TxidOps.equals(link.prevOutpoint.txid, prev.txid)) {
        return verifyFail({ kind: 'SpendLinkBroken', atIndex: i });
      }
    }
    const msg = linkSignedMessage(link.index, link.txid, link.fieldRoot);
    if (!keysVerify(link.linkPub, msg, link.signature).ok) {
      return verifyFail({ kind: 'BadLinkSignature', atIndex: i });
    }
  }
  return verifyOk();
}

export function verifyLinkProof(rootPub: Point, genesisMsg: Hash, proof: ChainLinkProof): VerifyResult<ChainVerifyReason> {
  let expected: Point;
  if (proof.index === 0) {
    expected = deriveHeadPub(rootPub, genesisMsg);
    if (!pointEq(proof.linkPub, expected)) return verifyFail({ kind: 'NotRootedAtPki' });
  } else {
    if (proof.prevTxid === undefined || proof.prevFieldRoot === undefined || proof.prevLinkPub === undefined || proof.prevOutpoint === undefined) {
      return verifyFail({ kind: 'BadChainProof', reason: 'missing predecessor data' });
    }
    expected = deriveNextPub(proof.prevLinkPub, linkMessage(proof.prevTxid, proof.prevFieldRoot, proof.fieldRoot));
    if (!pointEq(proof.linkPub, expected)) return verifyFail({ kind: 'BadChainProof', reason: 'linkPub mismatch' });
    if (!TxidOps.equals(proof.prevOutpoint.txid, proof.prevTxid)) {
      return verifyFail({ kind: 'SpendLinkBroken', atIndex: proof.index });
    }
  }
  const msg = linkSignedMessage(proof.index, proof.txid, proof.fieldRoot);
  if (!keysVerify(proof.linkPub, msg, proof.signature).ok) {
    return verifyFail({ kind: 'BadChainProof', reason: 'signature' });
  }
  return verifyOk();
}
