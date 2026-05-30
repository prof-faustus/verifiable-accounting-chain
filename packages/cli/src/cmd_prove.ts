// prove --leaves <file.json> --index <n> -> a proof bundle.
import { parseArgs } from 'node:util';
import { HashOps } from '@vaa/bsv';
import type { Hash } from '@vaa/bsv';
import { merkleProof, computeRoot } from '@vaa/merkle';
import { readJsonFile, printErr, printJson } from './args.js';
import { badArgs, failure } from './errors.js';

export function runProve(argv: string[]): number {
  let file: string | undefined;
  let indexRaw: string | undefined;
  try {
    const v = parseArgs({ args: argv, options: { leaves: { type: 'string' }, index: { type: 'string' } } }).values;
    file = v.leaves;
    indexRaw = v.index;
  } catch {
    printErr(badArgs('usage: vaa prove --leaves <file.json> --index <n>'));
    return 2;
  }
  if (file === undefined || indexRaw === undefined) {
    printErr(badArgs('--leaves <file.json> and --index <n> are required'));
    return 2;
  }
  if (!/^\d+$/.test(indexRaw)) {
    printErr(badArgs('--index must be a non-negative integer'));
    return 2;
  }
  const index = Number(indexRaw);
  const data = readJsonFile(file);
  if (!data.ok) {
    printErr(data.error);
    return 2;
  }
  const raw = (data.value as { leavesHex?: unknown }).leavesHex;
  if (!Array.isArray(raw) || raw.length === 0) {
    printErr(failure('file must contain a non-empty leavesHex array'));
    return 1;
  }
  const leaves: Hash[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') {
      printErr(failure('leavesHex entries must be strings'));
      return 1;
    }
    const h = HashOps.fromDisplayHex(item);
    if (!h.ok) {
      printErr(failure(`invalid leaf hex: ${item}`));
      return 1;
    }
    leaves.push(h.value);
  }
  if (index >= leaves.length) {
    printErr(failure('index is out of range'));
    return 1;
  }
  const proof = merkleProof(leaves, index);
  const root = computeRoot(leaves);
  if (!proof.ok || !root.ok) {
    printErr(failure('could not build proof'));
    return 1;
  }
  printJson({
    leafHex: HashOps.toDisplayHex(leaves[index] as Hash),
    proof: { index, siblingsHex: proof.value.siblings.map((h) => HashOps.toDisplayHex(h)) },
    rootHex: HashOps.toDisplayHex(root.value),
  });
  return 0;
}
