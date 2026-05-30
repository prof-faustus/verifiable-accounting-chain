// Public surface of @vaa/bundle.
export type { BundleError, BundleVerifyReason } from './errors.js';
export { fieldNotInTx, proofInvalid, chainEvidenceInvalid, notAnchored, schemaInvalid } from './errors.js';

export type { Inclusion, NodeContext, ProofBundle } from './build.js';
export { issueBundle } from './build.js';

export { verifyBundle } from './verify.js';
