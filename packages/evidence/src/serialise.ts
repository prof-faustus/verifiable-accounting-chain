// Canonical, versioned, deterministic serialisation of an evidence object — the
// anchored data item. Byte layout (VERSION 1):
//   version(0x01) | typeTag | body
// strings: varint length + UTF-8 bytes
// amounts: 8 bytes big-endian unsigned minor units; the one signed field
//          (ReconciliationItem.adjustment) is 8 bytes big-endian two's-complement.
import type { Result } from '@vaa/bsv';
import { ok, err, concat, writeVarInt, readVarInt } from '@vaa/bsv';
import type { EvidenceObject } from './schema.js';
import { typeTagOf, validate } from './schema.js';
import type { EvidenceError } from './errors.js';
import { serialiseBadVersion, deserialiseTruncated, schemaInvalid } from './errors.js';

export const VERSION = 1;

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

function encodeStr(s: string): Uint8Array {
  const bytes = encoder.encode(s);
  return concat(writeVarInt(BigInt(bytes.length)), bytes);
}

function encodeU64(value: bigint): Uint8Array {
  const out = new Uint8Array(8);
  let v = value & 0xffffffffffffffffn;
  for (let i = 7; i >= 0; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

function encodeI64(value: bigint): Uint8Array {
  // two's-complement over 64 bits
  const mod = 1n << 64n;
  const u = ((value % mod) + mod) % mod;
  return encodeU64(u);
}

export function serializeEvidence(obj: EvidenceObject): Uint8Array {
  const parts: Uint8Array[] = [Uint8Array.of(VERSION), Uint8Array.of(typeTagOf(obj))];
  switch (obj.type) {
    case 'invoice':
      parts.push(encodeStr(obj.id), encodeStr(obj.counterparty), encodeU64(obj.net), encodeU64(obj.tax), encodeU64(obj.discount), encodeU64(obj.gross));
      break;
    case 'payment':
      parts.push(encodeStr(obj.id), encodeStr(obj.counterparty), encodeU64(obj.amount));
      break;
    case 'ledgerEntry':
      parts.push(encodeStr(obj.id), encodeStr(obj.account), encodeU64(obj.debit), encodeU64(obj.credit));
      break;
    case 'reconciliationItem':
      parts.push(encodeStr(obj.id), encodeU64(obj.bookAmount), encodeI64(obj.adjustment));
      break;
  }
  return concat(...parts);
}

interface Reader {
  buf: Uint8Array;
  offset: number;
}

function readStr(r: Reader): Result<string, EvidenceError> {
  const len = readVarInt(r.buf, r.offset);
  if (!len.ok) return err(deserialiseTruncated());
  r.offset = len.value.nextOffset;
  const n = Number(len.value.value);
  if (r.offset + n > r.buf.length) return err(deserialiseTruncated());
  let s: string;
  try {
    s = decoder.decode(r.buf.subarray(r.offset, r.offset + n));
  } catch {
    return err(schemaInvalid('string', 'invalid UTF-8'));
  }
  r.offset += n;
  return ok(s);
}

function readU64(r: Reader): Result<bigint, EvidenceError> {
  if (r.offset + 8 > r.buf.length) return err(deserialiseTruncated());
  let v = 0n;
  for (let i = 0; i < 8; i++) v = (v << 8n) | BigInt(r.buf[r.offset + i] as number);
  r.offset += 8;
  return ok(v);
}

function readI64(r: Reader): Result<bigint, EvidenceError> {
  const u = readU64(r);
  if (!u.ok) return u;
  const signBit = 1n << 63n;
  const value = u.value >= signBit ? u.value - (1n << 64n) : u.value;
  return ok(value);
}

export function deserializeEvidence(bytes: Uint8Array): Result<EvidenceObject, EvidenceError> {
  if (bytes.length < 2) return err(deserialiseTruncated());
  if (bytes[0] !== VERSION) return err(serialiseBadVersion(bytes[0] as number));
  const tag = bytes[1] as number;
  const r: Reader = { buf: bytes, offset: 2 };
  let obj: EvidenceObject;
  if (tag === 0x01) {
    const id = readStr(r), counterparty = readStr(r), net = readU64(r), tax = readU64(r), discount = readU64(r), gross = readU64(r);
    for (const f of [id, counterparty, net, tax, discount, gross]) if (!f.ok) return err(f.error);
    obj = { type: 'invoice', id: (id as { ok: true; value: string }).value, counterparty: (counterparty as { ok: true; value: string }).value, net: (net as { ok: true; value: bigint }).value, tax: (tax as { ok: true; value: bigint }).value, discount: (discount as { ok: true; value: bigint }).value, gross: (gross as { ok: true; value: bigint }).value };
  } else if (tag === 0x02) {
    const id = readStr(r), counterparty = readStr(r), amount = readU64(r);
    for (const f of [id, counterparty, amount]) if (!f.ok) return err(f.error);
    obj = { type: 'payment', id: (id as { ok: true; value: string }).value, counterparty: (counterparty as { ok: true; value: string }).value, amount: (amount as { ok: true; value: bigint }).value };
  } else if (tag === 0x03) {
    const id = readStr(r), account = readStr(r), debit = readU64(r), credit = readU64(r);
    for (const f of [id, account, debit, credit]) if (!f.ok) return err(f.error);
    obj = { type: 'ledgerEntry', id: (id as { ok: true; value: string }).value, account: (account as { ok: true; value: string }).value, debit: (debit as { ok: true; value: bigint }).value, credit: (credit as { ok: true; value: bigint }).value };
  } else if (tag === 0x04) {
    const id = readStr(r), bookAmount = readU64(r), adjustment = readI64(r);
    for (const f of [id, bookAmount, adjustment]) if (!f.ok) return err(f.error);
    obj = { type: 'reconciliationItem', id: (id as { ok: true; value: string }).value, bookAmount: (bookAmount as { ok: true; value: bigint }).value, adjustment: (adjustment as { ok: true; value: bigint }).value };
  } else {
    return err(schemaInvalid('type', `unknown type tag ${tag}`));
  }
  const v = validate(obj);
  if (!v.ok) return err(v.error);
  return ok(obj);
}
