// Fault injection. Each in-scope fault is detected by the inclusion /
// selective-verification checks or by recomputation over the records.
import type { Hash } from '@vaa/bsv';
import { HashOps } from '@vaa/bsv';
import type { ProofStore, IndexKey } from '@vaa/proofstore';
import { recordLeaf, checkArRollForward } from '@vaa/evidence';
import type { ArPopulation } from './population.js';
import { rollForwardArrays } from './population.js';

export type FaultClass =
  | 'tamperedLeaf'
  | 'wrongIndex'
  | 'wrongRoot'
  | 'missingFragment'
  | 'alteredRecord'
  | 'omittedRecord'
  | 'duplicatedRecord';

export const FAULT_CLASSES: FaultClass[] = [
  'tamperedLeaf',
  'wrongIndex',
  'wrongRoot',
  'missingFragment',
  'alteredRecord',
  'omittedRecord',
  'duplicatedRecord',
];

export interface StudyContext {
  pop: ArPopulation;
  leaves: Hash[];
  store: ProofStore;
  keys: IndexKey[];
  anchoredIndices: number[];
}

function flip(h: Hash): Hash {
  const b = HashOps.toInternalBytes(h);
  b[0] = (b[0]! ^ 0xff) & 0xff;
  const r = HashOps.fromInternalBytes(b);
  if (!r.ok) throw new Error('unreachable: 32-byte hash');
  return r.value;
}

// Returns true if the fault is DETECTED by the system's checks.
export function detectFault(ctx: StudyContext, cls: FaultClass): boolean {
  const i = ctx.anchoredIndices[0] as number;
  const key = ctx.keys[i] as IndexKey;
  const q = ctx.store.query(key);
  if (!q.ok) return true; // a missing item is itself a detected fault
  const stored = q.value;
  const leaf = ctx.leaves[i] as Hash;

  switch (cls) {
    case 'tamperedLeaf':
      return !ctx.store.verify(flip(leaf), stored, 'adversarial').ok;
    case 'wrongIndex':
      return !ctx.store.verify(leaf, { ...stored, leafIndex: stored.leafIndex + 1 }, 'adversarial').ok;
    case 'wrongRoot':
      return !ctx.store.verify(leaf, { ...stored, expectedRoot: flip(stored.expectedRoot) }, 'adversarial').ok;
    case 'missingFragment': {
      const lowerOnly = { ...stored, shards: stored.shards.filter((s) => s.fromLevel === 0) };
      return !ctx.store.verify(leaf, lowerOnly, 'adversarial').ok;
    }
    case 'alteredRecord': {
      // Alter the underlying record; its recomputed leaf no longer matches the
      // anchored inclusion proof.
      const original = ctx.pop.records[i]!;
      const altered = { ...original, id: original.id + '-altered' };
      const newLeaf = recordLeaf(altered);
      return !ctx.store.verify(newLeaf, stored, 'adversarial').ok;
    }
    case 'omittedRecord': {
      // Drop one invoice but keep the stated close: the roll-forward no longer balances.
      const rf = rollForwardArrays(ctx.pop);
      const omitted = { ...rf, invoices: rf.invoices.slice(1) };
      return !checkArRollForward(omitted).ok;
    }
    case 'duplicatedRecord': {
      // Duplicate one invoice but keep the stated close: the roll-forward no longer balances.
      const rf = rollForwardArrays(ctx.pop);
      const duplicated = { ...rf, invoices: [rf.invoices[0]!, ...rf.invoices] };
      return !checkArRollForward(duplicated).ok;
    }
  }
}
