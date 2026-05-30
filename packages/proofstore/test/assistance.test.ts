import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HashOps } from '@vaa/bsv';
import { buildTree, computeRoot } from '@vaa/merkle';
import { computeProofAssistance, labelsHashToRoot } from '@vaa/proofstore';
import { makeLeaves, unwrap } from './util.mjs';

test('DC.3-T1 computeProofAssistance returns level-k node count and values', () => {
  const leaves = makeLeaves(11, 16);
  const tree = unwrap(buildTree(leaves));
  const k = 2;
  const assist = unwrap(computeProofAssistance(leaves, k));
  assert.equal(assist.predeterminedLevel, k);
  assert.equal(assist.nodeLabels.length, tree.levels[k]!.length);
  for (let i = 0; i < assist.nodeLabels.length; i++) {
    assert.equal(HashOps.equals(assist.nodeLabels[i]!, tree.levels[k]![i]!), true);
  }
});

test('DC.3-T2 labelsHashToRoot ok for genuine; AssistanceRootMismatch when altered', () => {
  const leaves = makeLeaves(12, 16);
  const root = unwrap(computeRoot(leaves));
  const assist = unwrap(computeProofAssistance(leaves, 2));
  assert.equal(labelsHashToRoot(assist, root).ok, true);

  const altered = { ...assist, nodeLabels: assist.nodeLabels.map((h) => h) };
  const b = HashOps.toInternalBytes(altered.nodeLabels[0]!);
  b[0] = b[0]! ^ 0xff;
  altered.nodeLabels[0] = HashOps.fromInternalBytes(b).value;
  const r = labelsHashToRoot(altered, root);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason.kind, 'AssistanceRootMismatch');
});
