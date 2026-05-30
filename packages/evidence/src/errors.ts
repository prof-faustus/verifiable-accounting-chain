// Typed errors and check reasons for the evidence package.

export type EvidenceError =
  | { kind: 'SchemaInvalid'; message: string; field: string; reason: string }
  | { kind: 'SerialiseBadVersion'; message: string; got: number }
  | { kind: 'DeserialiseTruncated'; message: string }
  | { kind: 'CheckMismatch'; message: string; check: string; computed: string; stated: string };

export const schemaInvalid = (field: string, reason: string): EvidenceError => ({
  kind: 'SchemaInvalid',
  message: `invalid ${field}: ${reason}`,
  field,
  reason,
});

export const serialiseBadVersion = (got: number): EvidenceError => ({
  kind: 'SerialiseBadVersion',
  message: `unsupported evidence version ${got}`,
  got,
});

export const deserialiseTruncated = (): EvidenceError => ({
  kind: 'DeserialiseTruncated',
  message: 'evidence buffer is truncated',
});

export const checkMismatch = (check: string, computed: bigint, stated: bigint): EvidenceError => ({
  kind: 'CheckMismatch',
  message: `${check}: computed ${computed} != stated ${stated}`,
  check,
  computed: computed.toString(),
  stated: stated.toString(),
});

// Reason carried by a recomputation check outcome.
export type CheckReason = { kind: 'CheckMismatch'; check: string; computed: string; stated: string };

export const checkReason = (check: string, computed: bigint, stated: bigint): CheckReason => ({
  kind: 'CheckMismatch',
  check,
  computed: computed.toString(),
  stated: stated.toString(),
});
