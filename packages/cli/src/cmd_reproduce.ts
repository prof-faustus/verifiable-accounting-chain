// reproduce -> regenerate every deterministic vector and diff against the
// committed outputs. Exits non-zero on any mismatch.
import { join } from 'node:path';
import { HashOps, TxidOps } from '@vaa/bsv';
import { computeRoot } from '@vaa/merkle';
import { measureStorage, ciVector as storageVector, SEED as STORAGE_SEED } from '@vaa/simstore';
import { measureAssurance, ciVector as assuranceVector, SEED as ASSURANCE_SEED, CI_M } from '@vaa/simstudy';
import { readJsonFile, repoRoot, must } from './args.js';

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

function diffJson(name: string, regenerated: unknown, committedPath: string): Check {
  const committed = readJsonFile(committedPath);
  if (!committed.ok) return { name, ok: false, detail: `cannot read committed vector: ${committedPath}` };
  const a = JSON.stringify(regenerated);
  const b = JSON.stringify(committed.value);
  return { name, ok: a === b, detail: a === b ? 'match' : 'MISMATCH against committed vector' };
}

export function runReproduce(): number {
  const checks: Check[] = [];

  // 1) Genuine BSV block Merkle vector: recompute the root from the stored txids.
  const blockPath = join(repoRoot(), 'vectors', 'merkle', 'bsv_block_v1.json');
  const block = readJsonFile(blockPath);
  if (!block.ok) {
    checks.push({ name: 'merkle/bsv_block_v1', ok: false, detail: 'cannot read block vector' });
  } else {
    const v = block.value as { txids: string[]; merkleRoot: string };
    const leaves = v.txids.map((t) => TxidOps.asHash(must(TxidOps.fromDisplayHex(t))));
    const root = computeRoot(leaves);
    const okRoot = root.ok && HashOps.toDisplayHex(root.value) === v.merkleRoot;
    checks.push({ name: 'merkle/bsv_block_v1', ok: okRoot, detail: okRoot ? 'recomputed root matches published merkle root' : 'MISMATCH' });
  }

  // 2) Storage study CI vector.
  checks.push(diffJson('study/storage_256', storageVector(measureStorage(STORAGE_SEED, 256)), join(repoRoot(), 'vectors', 'study', 'storage_256.json')));

  // 3) Assurance study CI vector.
  checks.push(diffJson('study/simstudy_240', assuranceVector(measureAssurance(ASSURANCE_SEED, CI_M)), join(repoRoot(), 'vectors', 'study', `simstudy_${CI_M}.json`)));

  let allOk = true;
  for (const c of checks) {
    process.stdout.write(`${c.ok ? 'OK  ' : 'FAIL'} ${c.name}: ${c.detail}\n`);
    if (!c.ok) allOk = false;
  }
  process.stdout.write(allOk ? 'reproduce: all vectors match\n' : 'reproduce: MISMATCH detected\n');
  return allOk ? 0 : 1;
}
