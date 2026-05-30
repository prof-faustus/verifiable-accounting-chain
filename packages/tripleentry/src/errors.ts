// Typed errors and verification reasons for the tripleentry package.
export type TripleEntryError =
  | { kind: 'UnbalancedEntry'; message: string; debit: string; credit: string }
  | { kind: 'SideMismatch'; message: string; side: 'debit' | 'credit'; reason: string }
  | { kind: 'SharedEntryNotReferenced'; message: string; side: 'debit' | 'credit' }
  | { kind: 'NotAnchored'; message: string }
  | { kind: 'SchemaInvalid'; message: string; field: string };

export const unbalancedEntry = (debit: bigint, credit: bigint): TripleEntryError => ({ kind: 'UnbalancedEntry', message: `unbalanced: debit ${debit} != credit ${credit}`, debit: debit.toString(), credit: credit.toString() });
export const sideMismatch = (side: 'debit' | 'credit', reason: string): TripleEntryError => ({ kind: 'SideMismatch', message: `${side} side disagrees with the shared entry: ${reason}`, side, reason });
export const sharedEntryNotReferenced = (side: 'debit' | 'credit'): TripleEntryError => ({ kind: 'SharedEntryNotReferenced', message: `${side} side does not reference the shared on-chain entry`, side });
export const notAnchored = (): TripleEntryError => ({ kind: 'NotAnchored', message: 'the shared entry root is not anchored' });
export const schemaInvalid = (field: string): TripleEntryError => ({ kind: 'SchemaInvalid', message: `invalid ${field}`, field });

export type TripleEntryVerifyReason =
  | { kind: 'UnbalancedEntry'; debit: string; credit: string }
  | { kind: 'SideMismatch'; side: 'debit' | 'credit' }
  | { kind: 'SharedEntryNotReferenced'; side: 'debit' | 'credit' }
  | { kind: 'NotAnchored' }
  | { kind: 'SchemaInvalid'; field: string };
