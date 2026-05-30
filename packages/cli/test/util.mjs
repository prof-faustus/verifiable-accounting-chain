// CLI test helpers: run the built binary as a subprocess and build fixture files.
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { HashOps, hashLeaf, meetsTarget, TxidOps } from '@vaa/bsv';
import { merkleProof, computeRoot } from '@vaa/merkle';

export const CLI = join(import.meta.dirname, '..', 'dist', 'index.js');

export function runCli(args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
}

const dir = mkdtempSync(join(tmpdir(), 'vaa-cli-'));
export function tmpFile(name, obj) {
  const p = join(dir, name);
  writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
  return p;
}

export function leavesHex(n) {
  const leaves = [];
  for (let i = 0; i < n; i++) leaves.push(hashLeaf(Uint8Array.of(i, i + 1, i + 2, 7)));
  return leaves.map((h) => HashOps.toDisplayHex(h));
}

export function leafObjects(n) {
  const hexes = leavesHex(n);
  const leaves = hexes.map((h) => HashOps.fromDisplayHex(h).value);
  return { hexes, leaves };
}

export function makeVerifiableBundle(n, index) {
  const { hexes, leaves } = leafObjects(n);
  const proof = merkleProof(leaves, index).value;
  const root = computeRoot(leaves).value;
  const rootHex = HashOps.toDisplayHex(root);

  let header = { version: 1, prevBlockHash: HashOps.zero(), merkleRoot: root, time: 0, bits: 0x2100ffff, nonce: 0 };
  while (!meetsTarget(header)) header = { ...header, nonce: header.nonce + 1 };

  return {
    leafHex: hexes[index],
    proof: { index, siblingsHex: proof.siblings.map((h) => HashOps.toDisplayHex(h)) },
    rootHex,
    headers: [
      {
        version: 1,
        prevBlockHashHex: HashOps.toDisplayHex(HashOps.zero()),
        merkleRootHex: rootHex,
        time: 0,
        bits: 0x2100ffff,
        nonce: header.nonce,
      },
    ],
  };
}

export function txidHexAt(i) {
  const t = new Uint8Array(32);
  t[0] = i & 0xff;
  return TxidOps.toDisplayHex(TxidOps.fromInternalBytes(t).value);
}
