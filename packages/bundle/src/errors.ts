// Typed errors and verification reasons for the bundle package.
export type BundleError =
  | { kind: 'FieldNotInTx'; message: string; tag: string }
  | { kind: 'ProofInvalid'; message: string }
  | { kind: 'ChainEvidenceInvalid'; message: string }
  | { kind: 'NotAnchored'; message: string }
  | { kind: 'SchemaInvalid'; message: string; field: string };

export const fieldNotInTx = (tag: string): BundleError => ({ kind: 'FieldNotInTx', message: `field not in transaction: ${tag}`, tag });
export const proofInvalid = (): BundleError => ({ kind: 'ProofInvalid', message: 'a disclosed field did not fold to the committed root' });
export const chainEvidenceInvalid = (): BundleError => ({ kind: 'ChainEvidenceInvalid', message: 'chain evidence did not verify' });
export const notAnchored = (): BundleError => ({ kind: 'NotAnchored', message: 'the committing transaction is not in a validated header' });
export const schemaInvalid = (field: string): BundleError => ({ kind: 'SchemaInvalid', message: `invalid ${field}`, field });

export type BundleVerifyReason =
  | { kind: 'ProofInvalid' }
  | { kind: 'NotAnchored' }
  | { kind: 'ChainEvidenceInvalid' }
  | { kind: 'MappingInvalid' }
  | { kind: 'AttestationInvalid' };
