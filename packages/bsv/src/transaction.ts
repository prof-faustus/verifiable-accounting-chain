// Transaction parsing. The SDK's parser is lenient about truncation and trailing
// bytes (verified), so this package performs a length-exact structural parse to
// deliver precise TxTruncated / TxMalformed errors and never throw on adversarial
// input. The txid is the double-SHA256 of the raw bytes (cross-checked against
// the SDK in tests).
//
// Error mapping:
//   - a fixed-size field or a script's declared bytes running past the buffer end
//     => TxTruncated (the buffer is short);
//   - an input/output count that exceeds what the remaining buffer could hold
//     => TxMalformed (a corrupt length prefix; internally inconsistent).
import type { Result } from './result.js';
import { ok, err } from './result.js';
import type { BsvError } from './errors.js';
import { txMalformed, txTruncated } from './errors.js';
import { readU32LE, readVarInt } from './bytes.js';
import type { Txid } from './txid.js';
import { fromInternalBytes as txidFromInternal, ofTransactionBytes } from './txid.js';
import type { Script } from './script.js';
import { fromBytes as scriptFromBytes } from './script.js';

export interface TxInput {
  readonly position: number;
  readonly prevTxid: Txid;
  readonly prevIndex: number;
  readonly unlockingScript: Script;
}

export interface TxOutput {
  readonly position: number;
  readonly lockingScript: Script;
  readonly amountMinorUnits: bigint;
}

export interface Transaction {
  readonly raw: Uint8Array;
  readonly inputsList: readonly TxInput[];
  readonly outputsList: readonly TxOutput[];
}

function readU64LE(buf: Uint8Array, offset: number): Result<bigint, BsvError> {
  if (offset + 8 > buf.length) return err(txTruncated(offset + 8, buf.length));
  let value = 0n;
  for (let i = 7; i >= 0; i--) {
    value = (value << 8n) | BigInt(buf[offset + i] as number);
  }
  return ok(value);
}

export function parseTransaction(raw: Uint8Array): Result<Transaction, BsvError> {
  let offset = 0;

  // version (4 LE)
  const version = readU32LE(raw, offset);
  if (!version.ok) return err(txTruncated(4, raw.length));
  offset += 4;

  // input count
  const inCount = readVarInt(raw, offset);
  if (!inCount.ok) return err(txTruncated(offset + 1, raw.length));
  offset = inCount.value.nextOffset;
  if (inCount.value.value > BigInt(raw.length)) {
    return err(txMalformed(`input count ${inCount.value.value} exceeds buffer`));
  }
  const numInputs = Number(inCount.value.value);

  const inputsList: TxInput[] = [];
  for (let i = 0; i < numInputs; i++) {
    // prevTxid (32, internal order)
    if (offset + 32 > raw.length) return err(txTruncated(offset + 32, raw.length));
    const prev = txidFromInternal(raw.subarray(offset, offset + 32));
    if (!prev.ok) return err(prev.error);
    offset += 32;
    // prevIndex (4 LE)
    const idx = readU32LE(raw, offset);
    if (!idx.ok) return err(txTruncated(offset + 4, raw.length));
    offset += 4;
    // unlocking script (varint length + bytes)
    const sLen = readVarInt(raw, offset);
    if (!sLen.ok) return err(txTruncated(offset + 1, raw.length));
    offset = sLen.value.nextOffset;
    const scriptLen = Number(sLen.value.value);
    if (sLen.value.value > BigInt(raw.length) || offset + scriptLen > raw.length) {
      // A declared script length larger than the whole buffer is a corrupt prefix;
      // otherwise the buffer is short.
      if (sLen.value.value > BigInt(raw.length)) {
        return err(txMalformed(`input ${i} script length ${sLen.value.value} exceeds buffer`));
      }
      return err(txTruncated(offset + scriptLen, raw.length));
    }
    const unlockingScript = scriptFromBytes(raw.subarray(offset, offset + scriptLen));
    offset += scriptLen;
    // sequence (4 LE)
    const seq = readU32LE(raw, offset);
    if (!seq.ok) return err(txTruncated(offset + 4, raw.length));
    offset += 4;
    inputsList.push({ position: i, prevTxid: prev.value, prevIndex: idx.value, unlockingScript });
  }

  // output count
  const outCount = readVarInt(raw, offset);
  if (!outCount.ok) return err(txTruncated(offset + 1, raw.length));
  offset = outCount.value.nextOffset;
  if (outCount.value.value > BigInt(raw.length)) {
    return err(txMalformed(`output count ${outCount.value.value} exceeds buffer`));
  }
  const numOutputs = Number(outCount.value.value);

  const outputsList: TxOutput[] = [];
  for (let i = 0; i < numOutputs; i++) {
    const amount = readU64LE(raw, offset);
    if (!amount.ok) return err(amount.error);
    offset += 8;
    const sLen = readVarInt(raw, offset);
    if (!sLen.ok) return err(txTruncated(offset + 1, raw.length));
    offset = sLen.value.nextOffset;
    const scriptLen = Number(sLen.value.value);
    if (sLen.value.value > BigInt(raw.length)) {
      return err(txMalformed(`output ${i} script length ${sLen.value.value} exceeds buffer`));
    }
    if (offset + scriptLen > raw.length) return err(txTruncated(offset + scriptLen, raw.length));
    const lockingScript = scriptFromBytes(raw.subarray(offset, offset + scriptLen));
    offset += scriptLen;
    outputsList.push({ position: i, lockingScript, amountMinorUnits: amount.value });
  }

  // locktime (4 LE)
  const locktime = readU32LE(raw, offset);
  if (!locktime.ok) return err(txTruncated(offset + 4, raw.length));
  offset += 4;

  return ok({ raw: Uint8Array.from(raw), inputsList, outputsList });
}

export function txid(tx: Transaction): Txid {
  return ofTransactionBytes(tx.raw);
}

export function inputs(tx: Transaction): readonly TxInput[] {
  return tx.inputsList;
}

export function outputs(tx: Transaction): readonly TxOutput[] {
  return tx.outputsList;
}

export function rawBytes(tx: Transaction): Uint8Array {
  return Uint8Array.from(tx.raw);
}
