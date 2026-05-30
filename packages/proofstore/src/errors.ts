// Typed errors and verification reasons for the proofstore package.

export type StoreError =
  | { kind: 'KeyError'; message: string; reason: 'negativePosition' | 'negativeBlockPosition' | 'negativeAmount' }
  | { kind: 'ShardBadLevel'; message: string; level: number; height: number }
  | { kind: 'ShardNonContiguous'; message: string }
  | { kind: 'AssistanceRootMismatch'; message: string }
  | { kind: 'AssistanceMismatch'; message: string }
  | { kind: 'KeyNotFound'; message: string; keyHex: string }
  | { kind: 'RootMismatch'; message: string }
  | { kind: 'TrustedOperationalNotAcceptedForAudit'; message: string };

export const keyError = (reason: 'negativePosition' | 'negativeBlockPosition' | 'negativeAmount'): StoreError => ({
  kind: 'KeyError',
  message: `invalid index key: ${reason}`,
  reason,
});

export const shardBadLevel = (level: number, height: number): StoreError => ({
  kind: 'ShardBadLevel',
  message: `predetermined level ${level} out of range (0, ${height})`,
  level,
  height,
});

export const shardNonContiguous = (): StoreError => ({
  kind: 'ShardNonContiguous',
  message: 'proof shards are not contiguous and covering',
});

export const assistanceRootMismatch = (): StoreError => ({
  kind: 'AssistanceRootMismatch',
  message: 'proof-assistance labels do not hash to the anchored root',
});

export const assistanceMismatch = (): StoreError => ({
  kind: 'AssistanceMismatch',
  message: 'folded node does not match the published proof-assistance label',
});

export const keyNotFound = (keyHex: string): StoreError => ({
  kind: 'KeyNotFound',
  message: `no stored proof for key ${keyHex}`,
  keyHex,
});

export const rootMismatch = (): StoreError => ({
  kind: 'RootMismatch',
  message: 'reconstructed root does not match the expected root',
});

export const trustedOperationalNotAcceptedForAudit = (): StoreError => ({
  kind: 'TrustedOperationalNotAcceptedForAudit',
  message: 'the trusted-operational mode is not adversarially sound and is refused by the audit path',
});

// Reasons carried by a verification outcome.
export type StoreVerifyReason =
  | { kind: 'RootMismatch' }
  | { kind: 'ShardNonContiguous' }
  | { kind: 'AssistanceMismatch' }
  | { kind: 'AssistanceRootMismatch' }
  | { kind: 'SiblingCountMismatch'; got: number; expected: number }
  | { kind: 'TrustedOperationalNotAcceptedForAudit' };

export type TrustedVerifyReason = { kind: 'TrustedSumMismatch' };
