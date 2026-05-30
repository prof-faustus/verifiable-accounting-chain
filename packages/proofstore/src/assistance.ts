// Public proof-assistance data (Selective Verification claim 8): the labels of
// the Merkle-tree nodes at the predetermined level. A verifier can confirm the
// labels are consistent with the anchored root using no private data.
import type { Hash, VerifyResult, Result } from '@vaa/bsv';
import { hashNode, HashOps, verifyOk, verifyFail, ok, err } from '@vaa/bsv';
import { buildTree } from '@vaa/merkle';
import type { StoreError } from './errors.js';
import { shardBadLevel } from './errors.js';

export interface ProofAssistance {
  readonly predeterminedLevel: number;
  readonly nodeLabels: Hash[];
}

export function computeProofAssistance(leaves: Hash[], predeterminedLevel: number): Result<ProofAssistance, StoreError> {
  const tree = buildTree(leaves);
  if (!tree.ok) {
    // EmptyLeaves; surface as a bad level for this level-indexed call.
    return err(shardBadLevel(predeterminedLevel, 0));
  }
  if (predeterminedLevel <= 0 || predeterminedLevel >= tree.value.levels.length) {
    return err(shardBadLevel(predeterminedLevel, tree.value.levels.length - 1));
  }
  return ok({
    predeterminedLevel,
    nodeLabels: (tree.value.levels[predeterminedLevel] as Hash[]).map((h) => h),
  });
}

export function labelsHashToRoot(a: ProofAssistance, root: Hash): VerifyResult<{ kind: 'AssistanceRootMismatch' }> {
  let current = a.nodeLabels;
  while (current.length > 1) {
    const next: Hash[] = [];
    for (let i = 0; i < current.length; i += 2) {
      const left = current[i] as Hash;
      const right = (i + 1 < current.length ? current[i + 1] : current[i]) as Hash;
      next.push(hashNode(left, right));
    }
    current = next;
  }
  if (HashOps.equals(current[0] as Hash, root)) return verifyOk();
  return verifyFail({ kind: 'AssistanceRootMismatch' });
}
