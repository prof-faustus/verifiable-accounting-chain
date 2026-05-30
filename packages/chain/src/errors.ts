// Typed errors and verification reasons for the chain package (Pillar 2).
export type ChainError =
  | { kind: 'BrokenLink'; message: string; atIndex: number }
  | { kind: 'NotRootedAtPki'; message: string }
  | { kind: 'LinkOutOfOrder'; message: string; expected: number; got: number }
  | { kind: 'BadChainProof'; message: string; reason: string }
  | { kind: 'SchemaInvalid'; message: string; field: string };

export const brokenLink = (atIndex: number): ChainError => ({ kind: 'BrokenLink', message: `broken link at index ${atIndex}`, atIndex });
export const notRootedAtPki = (): ChainError => ({ kind: 'NotRootedAtPki', message: 'chain head is not bound to the PKI root' });
export const linkOutOfOrder = (expected: number, got: number): ChainError => ({ kind: 'LinkOutOfOrder', message: `link out of order: expected predecessor ${expected}, got ${got}`, expected, got });
export const badChainProof = (reason: string): ChainError => ({ kind: 'BadChainProof', message: `bad chain proof: ${reason}`, reason });
export const schemaInvalid = (field: string): ChainError => ({ kind: 'SchemaInvalid', message: `invalid ${field}`, field });

export type ChainVerifyReason =
  | { kind: 'BrokenLink'; atIndex: number }
  | { kind: 'NotRootedAtPki' }
  | { kind: 'SpendLinkBroken'; atIndex: number }
  | { kind: 'BadLinkSignature'; atIndex: number }
  | { kind: 'BadChainProof'; reason: string };
