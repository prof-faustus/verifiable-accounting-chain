// query --key <file.json> -> the queried item's fragment only.
//
// The file is self-contained: it carries the population (leavesHex), the
// predetermined level, and the item (leafIndex + key). The command builds a proof
// store, anchors the item, and returns only that item's stored fragment.
import { parseArgs } from 'node:util';
import { HashOps, TxidOps } from '@vaa/bsv';
import type { Hash } from '@vaa/bsv';
import { ProofStore } from '@vaa/proofstore';
import type { IndexKey, Direction } from '@vaa/proofstore';
import { readJsonFile, printErr, printJson } from './args.js';
import { badArgs, failure } from './errors.js';

export function runQuery(argv: string[]): number {
  let file: string | undefined;
  try {
    file = parseArgs({ args: argv, options: { key: { type: 'string' } } }).values.key;
  } catch {
    printErr(badArgs('usage: vaa query --key <file.json>'));
    return 2;
  }
  if (file === undefined) {
    printErr(badArgs('--key <file.json> is required'));
    return 2;
  }
  const data = readJsonFile(file);
  if (!data.ok) {
    printErr(data.error);
    return 2;
  }
  const o = data.value as Record<string, unknown>;
  const raw = o['leavesHex'];
  const level = o['predeterminedLevel'];
  const leafIndex = o['leafIndex'];
  const keyObj = o['key'] as Record<string, unknown> | undefined;
  if (!Array.isArray(raw) || typeof level !== 'number' || typeof leafIndex !== 'number' || keyObj === undefined) {
    printErr(failure('file must contain leavesHex, predeterminedLevel, leafIndex, and key'));
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
  const txid = typeof keyObj['txidHex'] === 'string' ? TxidOps.fromDisplayHex(keyObj['txidHex']) : undefined;
  const direction = keyObj['direction'] === 'input' || keyObj['direction'] === 'output' ? (keyObj['direction'] as Direction) : undefined;
  if (txid === undefined || !txid.ok || direction === undefined || typeof keyObj['position'] !== 'number' || typeof keyObj['blockPosition'] !== 'number') {
    printErr(failure('key must contain txidHex, direction, position, blockPosition'));
    return 1;
  }
  const key: IndexKey = { txid: txid.value, direction, position: keyObj['position'], blockPosition: keyObj['blockPosition'] };

  const store = new ProofStore(level);
  const anchored = store.anchor(key, leaves, leafIndex);
  if (!anchored.ok) {
    printErr(failure(`anchor failed: ${anchored.error.kind}`));
    return 1;
  }
  const queried = store.query(key);
  if (!queried.ok) {
    printErr(failure(`query failed: ${queried.error.kind}`));
    return 1;
  }
  const s = queried.value;
  printJson({
    storedProof: {
      leafIndex: s.leafIndex,
      expectedRootHex: HashOps.toDisplayHex(s.expectedRoot),
      shards: s.shards.map((sh) => ({ fromLevel: sh.fromLevel, toLevel: sh.toLevel, siblingsHex: sh.siblings.map((h) => HashOps.toDisplayHex(h)) })),
    },
  });
  return 0;
}
