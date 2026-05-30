// Public surface of @vaa/keys (Pillar 1: PKI root + general-ledger key hierarchy).
export type { KeysError, KeysVerifyReason } from './errors.js';
export {
  badPathSegment,
  derivationOutOfRange,
  notUnderRoot,
  badSignature,
  schemaInvalid,
} from './errors.js';

export { generatorValue, derivePrivChild, derivePubChild } from './derive.js';

export type { LedgerPath, RootKeyPair, RootProvider } from './hierarchy.js';
export {
  rootFromSeed,
  seededRootProvider,
  derivePathPub,
  derivePathPriv,
  nodeKeyFor,
  verifyNodeUnderRoot,
} from './hierarchy.js';

export type { Sig } from './sign.js';
export { sign, verify, isLowS, attestStructure, verifyAttestation } from './sign.js';
