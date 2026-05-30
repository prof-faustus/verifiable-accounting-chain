// Typed errors and verification reasons for the merkle package.

export type MerkleError =
  | { kind: 'EmptyLeaves'; message: string }
  | { kind: 'IndexOutOfRange'; message: string; index: number; leafCount: number }
  | { kind: 'SiblingCountMismatch'; message: string; got: number; expected: number };

export const emptyLeaves = (): MerkleError => ({
  kind: 'EmptyLeaves',
  message: 'cannot build a tree from zero leaves',
});

export const indexOutOfRange = (index: number, leafCount: number): MerkleError => ({
  kind: 'IndexOutOfRange',
  message: `leaf index ${index} out of range for ${leafCount} leaves`,
  index,
  leafCount,
});

export const siblingCountMismatch = (got: number, expected: number): MerkleError => ({
  kind: 'SiblingCountMismatch',
  message: `proof has ${got} siblings, expected ${expected}`,
  got,
  expected,
});

// Reasons a verification can fail (carried in a VerifyResult).
export type MerkleVerifyReason =
  | { kind: 'SiblingCountMismatch'; got: number; expected: number }
  | { kind: 'RootMismatch' }
  | { kind: 'RootNotAnchored' };
