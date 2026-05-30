// Fixture loader (plain JS so it imports cleanly into type-stripped test files).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(import.meta.dirname, 'fixtures');

export function readJson(name) {
  return JSON.parse(readFileSync(join(dir, name), 'utf8'));
}

export const txFixture = readJson('transaction.json');
export const blockFixture = readJson('block.json');
export const headersFixture = readJson('headers.json');

export function hexToBytes(hex) {
  return Uint8Array.from(Buffer.from(hex, 'hex'));
}

// Unwrap a Result, throwing if it is an error (test convenience).
export function unwrap(r) {
  if (!r.ok) throw new Error('expected ok, got error: ' + JSON.stringify(r.error));
  return r.value;
}

// Build a BlockHeader value from a fixture header record.
export async function buildHeader(rec) {
  const { HashOps } = await import('@vaa/bsv');
  return {
    version: rec.version,
    prevBlockHash: unwrap(HashOps.fromDisplayHex(rec.previousblockhash)),
    merkleRoot: unwrap(HashOps.fromDisplayHex(rec.merkleroot)),
    time: rec.time,
    bits: rec.bits,
    nonce: rec.nonce,
  };
}

