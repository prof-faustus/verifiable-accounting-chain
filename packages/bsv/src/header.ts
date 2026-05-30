// Bitcoin (BSV) 80-byte block header.
//   0  4   version        uint32 little-endian
//   4  32  prevBlockHash  32 bytes, internal order
//   36 32  merkleRoot     32 bytes, internal order
//   68 4   time           uint32 little-endian
//   72 4   bits           uint32 little-endian (compact target)
//   76 4   nonce          uint32 little-endian
import type { Result } from './result.js';
import { ok, err } from './result.js';
import type { BsvError } from './errors.js';
import { headerBadLength } from './errors.js';
import type { Hash } from './hash.js';
import { fromInternalBytes, toInternalBytes, toDisplayHex } from './hash.js';
import { readU32LE, writeU32LE } from './bytes.js';
import { doubleSha256 } from './hashing.js';

export interface BlockHeader {
  readonly version: number;
  readonly prevBlockHash: Hash;
  readonly merkleRoot: Hash;
  readonly time: number;
  readonly bits: number;
  readonly nonce: number;
}

export const HEADER_LEN = 80;

export function parseHeader(raw: Uint8Array): Result<BlockHeader, BsvError> {
  if (raw.length !== HEADER_LEN) return err(headerBadLength(raw.length));
  const version = readU32LE(raw, 0);
  const prev = fromInternalBytes(raw.subarray(4, 36));
  const root = fromInternalBytes(raw.subarray(36, 68));
  const time = readU32LE(raw, 68);
  const bits = readU32LE(raw, 72);
  const nonce = readU32LE(raw, 76);
  if (!version.ok) return err(version.error);
  if (!prev.ok) return err(prev.error);
  if (!root.ok) return err(root.error);
  if (!time.ok) return err(time.error);
  if (!bits.ok) return err(bits.error);
  if (!nonce.ok) return err(nonce.error);
  return ok({
    version: version.value,
    prevBlockHash: prev.value,
    merkleRoot: root.value,
    time: time.value,
    bits: bits.value,
    nonce: nonce.value,
  });
}

export function serializeHeader(h: BlockHeader): Uint8Array {
  const out = new Uint8Array(HEADER_LEN);
  writeU32LE(h.version, out, 0);
  out.set(toInternalBytes(h.prevBlockHash), 4);
  out.set(toInternalBytes(h.merkleRoot), 36);
  writeU32LE(h.time, out, 68);
  writeU32LE(h.bits, out, 72);
  writeU32LE(h.nonce, out, 76);
  return out;
}

export function headerHash(h: BlockHeader): Hash {
  return doubleSha256(serializeHeader(h));
}

export function targetFromBits(bits: number): bigint {
  const exponent = bits >>> 24;
  const mantissa = BigInt(bits & 0x007fffff);
  if (exponent <= 3) {
    return mantissa >> (8n * BigInt(3 - exponent));
  }
  return mantissa << (8n * BigInt(exponent - 3));
}

export function meetsTarget(h: BlockHeader): boolean {
  // Display order is the big-endian numeric presentation of the hash.
  const hashBE = BigInt('0x' + toDisplayHex(headerHash(h)));
  return hashBE <= targetFromBits(h.bits);
}
