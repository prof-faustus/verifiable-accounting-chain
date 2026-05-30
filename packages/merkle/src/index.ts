// Public surface of @vaa/merkle.
export type { MerkleError, MerkleVerifyReason } from './errors.js';
export { emptyLeaves, indexOutOfRange, siblingCountMismatch } from './errors.js';

export type { MerkleTree } from './tree.js';
export { buildTree, computeRoot, leafIndexOfTxid } from './tree.js';

export type { MerkleProof } from './proof.js';
export { merkleProof } from './proof.js';

export { reconstructRoot, verifyProof, proveAgainstChain, heightForLeafCount } from './verify.js';
