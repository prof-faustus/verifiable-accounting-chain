// Assemble the tiny auditor proof bundle (Part 1A): the disclosed field(s), each
// field's Merkle path to the committed root, the chain-link proof binding the
// transaction into the PKI-rooted chain, and the committing transaction's
// inclusion proof. The bundle contains ONLY the requested fields' values.
import type { Hash, Txid, Result } from '@vaa/bsv';
import { ok, err } from '@vaa/bsv';
import type { AccountingField, AccountingTransaction } from '@vaa/evidence';
import { discloseField } from '@vaa/evidence';
import type { MerkleProof } from '@vaa/merkle';
import type { TransactionChain, ChainLinkProof } from '@vaa/chain';
import type { Sig } from '@vaa/keys';
import type { BundleError } from './errors.js';
import { fieldNotInTx, chainEvidenceInvalid, schemaInvalid } from './errors.js';

export interface Inclusion {
  txid: Txid;
  merklePath: MerkleProof;
}

export interface NodeContext {
  inclusion: Inclusion;
  rootAttestation?: Sig;
  headDigest?: Hash;
}

export interface ProofBundle {
  disclosedFields: AccountingField[];
  fieldProofs: { leafIndex: number; path: MerkleProof }[];
  fieldTreeRoot: Hash;
  chainLinkProof: ChainLinkProof;
  inclusion: Inclusion;
  rootAttestation?: Sig;
  headDigest?: Hash;
}

export function issueBundle(
  tx: AccountingTransaction,
  fieldIndices: number[],
  chain: TransactionChain,
  chainIndex: number,
  ctx: NodeContext,
): Result<ProofBundle, BundleError> {
  if (fieldIndices.length === 0) return err(schemaInvalid('fieldIndices'));
  const disclosedFields: AccountingField[] = [];
  const fieldProofs: { leafIndex: number; path: MerkleProof }[] = [];
  let fieldTreeRoot: Hash | undefined;
  for (const idx of fieldIndices) {
    const d = discloseField(tx, idx);
    if (!d.ok) return err(fieldNotInTx(`index:${idx}`));
    disclosedFields.push(d.value.field);
    fieldProofs.push({ leafIndex: d.value.leafIndex, path: d.value.proof });
    fieldTreeRoot = d.value.root;
  }
  if (fieldTreeRoot === undefined) return err(schemaInvalid('fieldIndices'));

  const linkProof = chain.linkProof(chainIndex);
  if (!linkProof.ok) return err(chainEvidenceInvalid());

  const bundle: ProofBundle = {
    disclosedFields,
    fieldProofs,
    fieldTreeRoot,
    chainLinkProof: linkProof.value,
    inclusion: ctx.inclusion,
  };
  if (ctx.rootAttestation !== undefined) bundle.rootAttestation = ctx.rootAttestation;
  if (ctx.headDigest !== undefined) bundle.headDigest = ctx.headDigest;
  return ok(bundle);
}
