// Loads the genuine BSV block Merkle vector and builds the header + leaf hashes.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TxidOps, HashOps } from '@vaa/bsv';

const path = join(import.meta.dirname, '..', '..', '..', 'vectors', 'merkle', 'bsv_block_v1.json');
export const blockVector = JSON.parse(readFileSync(path, 'utf8'));

export function leafHashes() {
  return blockVector.txids.map((t) => TxidOps.asHash(TxidOps.fromDisplayHex(t).value));
}

export function blockHeader() {
  return {
    version: blockVector.version,
    prevBlockHash: HashOps.fromDisplayHex(blockVector.previousBlockHash).value,
    merkleRoot: HashOps.fromDisplayHex(blockVector.merkleRoot).value,
    time: blockVector.time,
    bits: blockVector.bits,
    nonce: blockVector.nonce,
  };
}
