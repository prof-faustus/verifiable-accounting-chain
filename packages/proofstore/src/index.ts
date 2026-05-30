// Public surface of @vaa/proofstore.
export type { StoreError, StoreVerifyReason, TrustedVerifyReason } from './errors.js';
export {
  keyError,
  shardBadLevel,
  shardNonContiguous,
  assistanceRootMismatch,
  assistanceMismatch,
  keyNotFound,
  rootMismatch,
  trustedOperationalNotAcceptedForAudit,
} from './errors.js';

export type { Direction, IndexKey } from './indexkey.js';
export { validateKey, serializeKey } from './indexkey.js';

export type { ProofShard, StoredProof } from './shard.js';
export { shardProof, reassemble } from './shard.js';

export type { ProofAssistance } from './assistance.js';
export { computeProofAssistance, labelsHashToRoot } from './assistance.js';

export { serialiseShard, retrievalBytesAdversarial, retrievalBytesAssisted } from './payload.js';

export { homomorphicCommitment, verifyTrustedOperational } from './trusted.js';

export { ProofStore } from './store.js';
