// Typed errors and verification reasons for the ledgermap package (EP3420669B1).
export type LedgerMapError =
  | { kind: 'BadPath'; message: string; path: string; reason: 'empty' | 'badSegment' | 'duplicate' }
  | { kind: 'UnknownNode'; message: string; path: string }
  | { kind: 'NotUnderRoot'; message: string; path: string }
  | { kind: 'MappingVersionMismatch'; message: string; expected: number; got: number }
  | { kind: 'FieldNotMapped'; message: string; tag: string };

export const badPath = (path: string, reason: 'empty' | 'badSegment' | 'duplicate'): LedgerMapError => ({ kind: 'BadPath', message: `bad path ${path}: ${reason}`, path, reason });
export const unknownNode = (path: string): LedgerMapError => ({ kind: 'UnknownNode', message: `unknown node ${path}`, path });
export const notUnderRoot = (path: string): LedgerMapError => ({ kind: 'NotUnderRoot', message: `node ${path} is not under the structure root`, path });
export const mappingVersionMismatch = (expected: number, got: number): LedgerMapError => ({ kind: 'MappingVersionMismatch', message: `mapping version mismatch: expected ${expected}, got ${got}`, expected, got });
export const fieldNotMapped = (tag: string): LedgerMapError => ({ kind: 'FieldNotMapped', message: `field not mapped: ${tag}`, tag });

export type LedgerMapVerifyReason = { kind: 'NotUnderRoot'; path: string } | { kind: 'MappingRootMismatch' };
