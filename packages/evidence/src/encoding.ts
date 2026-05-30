// PART 5C-P3 pinned on-chain encoding. Data is carried as PUSHDATA in script,
// inside OP_FALSE OP_IF ... OP_ENDIF envelopes (bsv.buildScriptDataEnvelope),
// across the outputs of ONE Bitcoin (BSV) transaction. OP_RETURN IS NEVER USED.
//
// Each TLV item is framed as: type(1) | length(uint32 BE) | body. All multi-byte
// integers are big-endian; all 32-byte hashes/points are internal order; points
// are compressed (33 bytes).
import type { Hash, Txid, Point, Result, Script } from '@vaa/bsv';
import {
  ok,
  err,
  concat,
  HashOps,
  TxidOps,
  encodePoint,
  decodePoint,
} from '@vaa/bsv';
import type { EvidenceError } from './errors.js';
import { deserialiseTruncated, schemaInvalid } from './errors.js';
const invalid = (field: string): EvidenceError => schemaInvalid(field, 'invalid');

export const ITEM_HEADER = 0x01;
export const ITEM_FIELD = 0x02;
export const ITEM_ROOT_PART = 0x03;
export const ITEM_ASSIST = 0x04;
export const ITEM_CHAIN_LINK = 0x05;
export const ITEM_MAPPING_ROOT = 0x06;
export const ITEM_TRIPLE_REF = 0x07;
export const ITEM_PKI_ATTEST = 0x08;

export type ChainItem =
  | { type: 'header'; kind: number; fieldCount: number; fieldTreeRoot: Hash; rootPartScheme: number; partCount: number }
  | { type: 'field'; leafIndex: number; tag: string; value: Uint8Array }
  | { type: 'rootPart'; partIndex: number; partTotal: number; segOffset: number; segLen: number; seg: Uint8Array }
  | { type: 'assist'; level: number; labels: Hash[] }
  | { type: 'chainLink'; index: number; prevTxid: Txid; prevFieldRoot: Hash; prevOutpointVout: number; linkPub: Point; signature: Uint8Array }
  | { type: 'mappingRoot'; mappingVersion: number; mappingRoot: Hash }
  | { type: 'tripleRef'; side: 'debit' | 'credit'; sharedTxid: Txid; sharedVout: number }
  | { type: 'pkiAttest'; headDigest: Hash; rootSignature: Uint8Array };

const textEnc = new TextEncoder();
const textDec = new TextDecoder('utf-8', { fatal: true });

// ---- writer ----
class Writer {
  private readonly parts: Uint8Array[] = [];
  u8(v: number): void {
    this.parts.push(Uint8Array.of(v & 0xff));
  }
  u16(v: number): void {
    this.parts.push(Uint8Array.of((v >>> 8) & 0xff, v & 0xff));
  }
  u32(v: number): void {
    this.parts.push(Uint8Array.of((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff));
  }
  bytes(b: Uint8Array): void {
    this.parts.push(b);
  }
  done(): Uint8Array {
    return concat(...this.parts);
  }
}

// ---- reader ----
class ReaderUnderflow extends Error {}
class Reader {
  private off = 0;
  constructor(private readonly buf: Uint8Array) {}
  remaining(): number {
    return this.buf.length - this.off;
  }
  u8(): number {
    if (this.off + 1 > this.buf.length) throw new ReaderUnderflow();
    return this.buf[this.off++] as number;
  }
  u16(): number {
    if (this.off + 2 > this.buf.length) throw new ReaderUnderflow();
    const v = ((this.buf[this.off] as number) << 8) | (this.buf[this.off + 1] as number);
    this.off += 2;
    return v;
  }
  u32(): number {
    if (this.off + 4 > this.buf.length) throw new ReaderUnderflow();
    const v = ((this.buf[this.off] as number) * 0x1000000) + ((this.buf[this.off + 1] as number) << 16) + ((this.buf[this.off + 2] as number) << 8) + (this.buf[this.off + 3] as number);
    this.off += 4;
    return v >>> 0;
  }
  bytes(n: number): Uint8Array {
    if (n < 0 || this.off + n > this.buf.length) throw new ReaderUnderflow();
    const out = this.buf.subarray(this.off, this.off + n);
    this.off += n;
    return Uint8Array.from(out);
  }
}

// The exact FIELD-item body that is hashed to the field leaf (on-chain bytes ==
// hashed bytes): leafIndex(u32) | tagLen(u16) | tag | valueLen(u32) | value.
export function fieldItemBody(leafIndex: number, tag: string, value: Uint8Array): Uint8Array {
  const w = new Writer();
  w.u32(leafIndex);
  const tagBytes = textEnc.encode(tag);
  w.u16(tagBytes.length);
  w.bytes(tagBytes);
  w.u32(value.length);
  w.bytes(value);
  return w.done();
}

function encodeBody(item: ChainItem): { type: number; body: Uint8Array } {
  const w = new Writer();
  switch (item.type) {
    case 'header':
      w.u8(item.kind);
      w.u32(item.fieldCount);
      w.bytes(HashOps.toInternalBytes(item.fieldTreeRoot));
      w.u8(item.rootPartScheme);
      w.u8(item.partCount);
      return { type: ITEM_HEADER, body: w.done() };
    case 'field':
      return { type: ITEM_FIELD, body: fieldItemBody(item.leafIndex, item.tag, item.value) };
    case 'rootPart':
      w.u8(item.partIndex);
      w.u8(item.partTotal);
      w.u32(item.segOffset);
      w.u32(item.segLen);
      w.bytes(item.seg);
      return { type: ITEM_ROOT_PART, body: w.done() };
    case 'assist':
      w.u8(item.level);
      w.u32(item.labels.length);
      for (const l of item.labels) w.bytes(HashOps.toInternalBytes(l));
      return { type: ITEM_ASSIST, body: w.done() };
    case 'chainLink':
      w.u32(item.index);
      w.bytes(TxidOps.toInternalBytes(item.prevTxid));
      w.bytes(HashOps.toInternalBytes(item.prevFieldRoot));
      w.u32(item.prevOutpointVout);
      w.bytes(encodePoint(item.linkPub));
      w.u16(item.signature.length);
      w.bytes(item.signature);
      return { type: ITEM_CHAIN_LINK, body: w.done() };
    case 'mappingRoot':
      w.u32(item.mappingVersion);
      w.bytes(HashOps.toInternalBytes(item.mappingRoot));
      return { type: ITEM_MAPPING_ROOT, body: w.done() };
    case 'tripleRef':
      w.u8(item.side === 'debit' ? 0x00 : 0x01);
      w.bytes(TxidOps.toInternalBytes(item.sharedTxid));
      w.u32(item.sharedVout);
      return { type: ITEM_TRIPLE_REF, body: w.done() };
    case 'pkiAttest':
      w.bytes(HashOps.toInternalBytes(item.headDigest));
      w.u16(item.rootSignature.length);
      w.bytes(item.rootSignature);
      return { type: ITEM_PKI_ATTEST, body: w.done() };
  }
}

export function encodeItem(item: ChainItem): Uint8Array {
  const { type, body } = encodeBody(item);
  const w = new Writer();
  w.u8(type);
  w.u32(body.length);
  w.bytes(body);
  return w.done();
}

export function encodeStream(items: ChainItem[]): Uint8Array {
  return concat(...items.map((i) => encodeItem(i)));
}

function decodeBody(type: number, body: Uint8Array): Result<ChainItem, EvidenceError> {
  const r = new Reader(body);
  try {
    switch (type) {
      case ITEM_HEADER: {
        const kind = r.u8();
        const fieldCount = r.u32();
        const fieldTreeRoot = HashOps.fromInternalBytes(r.bytes(32));
        const rootPartScheme = r.u8();
        const partCount = r.u8();
        if (!fieldTreeRoot.ok) return err(invalid('fieldTreeRoot'));
        return ok({ type: 'header', kind, fieldCount, fieldTreeRoot: fieldTreeRoot.value, rootPartScheme, partCount });
      }
      case ITEM_FIELD: {
        const leafIndex = r.u32();
        const tagLen = r.u16();
        const tag = textDec.decode(r.bytes(tagLen));
        const valueLen = r.u32();
        const value = r.bytes(valueLen);
        return ok({ type: 'field', leafIndex, tag, value });
      }
      case ITEM_ROOT_PART: {
        const partIndex = r.u8();
        const partTotal = r.u8();
        const segOffset = r.u32();
        const segLen = r.u32();
        const seg = r.bytes(segLen);
        return ok({ type: 'rootPart', partIndex, partTotal, segOffset, segLen, seg });
      }
      case ITEM_ASSIST: {
        const level = r.u8();
        const labelCount = r.u32();
        const labels: Hash[] = [];
        for (let i = 0; i < labelCount; i++) {
          const h = HashOps.fromInternalBytes(r.bytes(32));
          if (!h.ok) return err(invalid('assistLabel'));
          labels.push(h.value);
        }
        return ok({ type: 'assist', level, labels });
      }
      case ITEM_CHAIN_LINK: {
        const index = r.u32();
        const prevTxid = TxidOps.fromInternalBytes(r.bytes(32));
        const prevFieldRoot = HashOps.fromInternalBytes(r.bytes(32));
        const prevOutpointVout = r.u32();
        const linkPub = decodePoint(r.bytes(33));
        const sigLen = r.u16();
        const signature = r.bytes(sigLen);
        if (!prevTxid.ok || !prevFieldRoot.ok || !linkPub.ok) return err(invalid('chainLink'));
        return ok({ type: 'chainLink', index, prevTxid: prevTxid.value, prevFieldRoot: prevFieldRoot.value, prevOutpointVout, linkPub: linkPub.value, signature });
      }
      case ITEM_MAPPING_ROOT: {
        const mappingVersion = r.u32();
        const mappingRoot = HashOps.fromInternalBytes(r.bytes(32));
        if (!mappingRoot.ok) return err(invalid('mappingRoot'));
        return ok({ type: 'mappingRoot', mappingVersion, mappingRoot: mappingRoot.value });
      }
      case ITEM_TRIPLE_REF: {
        const sideByte = r.u8();
        const sharedTxid = TxidOps.fromInternalBytes(r.bytes(32));
        const sharedVout = r.u32();
        if (!sharedTxid.ok) return err(invalid('tripleRef'));
        return ok({ type: 'tripleRef', side: sideByte === 0x00 ? 'debit' : 'credit', sharedTxid: sharedTxid.value, sharedVout });
      }
      case ITEM_PKI_ATTEST: {
        const headDigest = HashOps.fromInternalBytes(r.bytes(32));
        const sigLen = r.u16();
        const rootSignature = r.bytes(sigLen);
        if (!headDigest.ok) return err(invalid('pkiAttest'));
        return ok({ type: 'pkiAttest', headDigest: headDigest.value, rootSignature });
      }
      default:
        return err(invalid(`unknownItemType:${type}`));
    }
  } catch (e) {
    if (e instanceof ReaderUnderflow) return err(deserialiseTruncated());
    return err(invalid('decode'));
  }
}

export function decodeStream(bytes: Uint8Array): Result<ChainItem[], EvidenceError> {
  const r = new Reader(bytes);
  const items: ChainItem[] = [];
  try {
    while (r.remaining() > 0) {
      const type = r.u8();
      const len = r.u32();
      const body = r.bytes(len);
      const item = decodeBody(type, body);
      if (!item.ok) return err(item.error);
      items.push(item.value);
    }
  } catch (e) {
    if (e instanceof ReaderUnderflow) return err(deserialiseTruncated());
    return err(invalid('stream'));
  }
  return ok(items);
}

// ---- envelope packing (across outputs of ONE Bitcoin (BSV) transaction) ----
import { buildScriptDataEnvelope, recognise } from '@vaa/bsv';

// Chunk size that forces a large field set to span multiple envelopes/outputs.
export const EVIDENCE_ENVELOPE_CHUNK = 10_000;

export function packEnvelopes(stream: Uint8Array): Result<Script[], EvidenceError> {
  const scripts: Script[] = [];
  for (let off = 0; off < stream.length || scripts.length === 0; off += EVIDENCE_ENVELOPE_CHUNK) {
    const chunk = stream.subarray(off, Math.min(off + EVIDENCE_ENVELOPE_CHUNK, stream.length));
    const env = buildScriptDataEnvelope(chunk);
    if (!env.ok) return err(invalid('envelope'));
    scripts.push(env.value.lockingScript);
    if (stream.length === 0) break;
  }
  return ok(scripts);
}

export function unpackEnvelopes(scripts: Script[]): Result<Uint8Array, EvidenceError> {
  const parts: Uint8Array[] = [];
  for (const s of scripts) {
    const payload = recognise(s);
    if (!payload.ok) return err(invalid('notEnvelope'));
    parts.push(payload.value);
  }
  return ok(concat(...parts));
}
