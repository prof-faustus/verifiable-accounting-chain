// Verify a proof bundle: selective disclosure (each field folds to the committed
// root) + anchor (the committing tx is in a validated BSV header) + chain (the tx
// is a link in the PKI-rooted chain) + optional PKI attestation. Terminates in
// the BSV header chain. Reveals nothing about any other field or record.
import type { Point, Hash, VerifyResult, HeaderChain } from '@vaa/bsv';
import { HashOps, TxidOps, verifyOk, verifyFail } from '@vaa/bsv';
import { reconstructRoot } from '@vaa/merkle';
import { fieldLeaf } from '@vaa/evidence';
import { verifyLinkProof } from '@vaa/chain';
import { verifyAttestation } from '@vaa/keys';
import type { ProofBundle } from './build.js';
import type { BundleVerifyReason } from './errors.js';

export function verifyBundle(
  rootPub: Point,
  genesisMsg: Hash,
  headerChain: HeaderChain,
  bundle: ProofBundle,
): VerifyResult<BundleVerifyReason> {
  // (a) selective disclosure: each disclosed field belongs to the committed root.
  if (bundle.fieldProofs.length !== bundle.disclosedFields.length) return verifyFail({ kind: 'ProofInvalid' });
  for (let i = 0; i < bundle.disclosedFields.length; i++) {
    const fp = bundle.fieldProofs[i];
    const field = bundle.disclosedFields[i];
    if (fp === undefined || field === undefined) return verifyFail({ kind: 'ProofInvalid' });
    const leaf = fieldLeaf(fp.leafIndex, field);
    if (!HashOps.equals(reconstructRoot(leaf, fp.path), bundle.fieldTreeRoot)) return verifyFail({ kind: 'ProofInvalid' });
  }

  // tie the chain link and inclusion to the committed field-tree root.
  if (!HashOps.equals(bundle.chainLinkProof.fieldRoot, bundle.fieldTreeRoot)) return verifyFail({ kind: 'ChainEvidenceInvalid' });
  if (!TxidOps.equals(bundle.chainLinkProof.txid, bundle.inclusion.txid)) return verifyFail({ kind: 'ChainEvidenceInvalid' });

  // (b) anchor: the committing tx's inclusion folds to a block root in the chain.
  const blockRoot = reconstructRoot(TxidOps.asHash(bundle.inclusion.txid), bundle.inclusion.merklePath);
  if (headerChain.containsMerkleRoot(blockRoot) === undefined) return verifyFail({ kind: 'NotAnchored' });

  // (c) chain: the transaction is a link in the PKI-rooted provable chain.
  if (!verifyLinkProof(rootPub, genesisMsg, bundle.chainLinkProof).ok) return verifyFail({ kind: 'ChainEvidenceInvalid' });

  // (d) optional PKI attestation over the period chain head.
  if (bundle.rootAttestation !== undefined && bundle.headDigest !== undefined) {
    if (!verifyAttestation(rootPub, HashOps.toInternalBytes(bundle.headDigest), bundle.rootAttestation).ok) {
      return verifyFail({ kind: 'AttestationInvalid' });
    }
  }

  return verifyOk();
}
