// Carry data as pushdata inside script. OP_RETURN IS NEVER USED. The envelope is
//   OP_FALSE OP_IF <minimal-pushdata payload> OP_ENDIF
// The guard (OP_FALSE OP_IF ... OP_ENDIF) means the pushed bytes are never
// executed, so the output stays spendable while the data remains recoverable.
import type { Result } from './result.js';
import { ok, err } from './result.js';
import type { BsvError } from './errors.js';
import { envelopeOversize, envelopeNotRecognised } from './errors.js';
import type { Script } from './script.js';
import { fromBytes as scriptFromBytes, toBytes as scriptToBytes } from './script.js';
import { concat } from './bytes.js';

const OP_FALSE = 0x00;
const OP_IF = 0x63;
const OP_ENDIF = 0x68;
const OP_RETURN = 0x6a;
const OP_PUSHDATA1 = 0x4c;
const OP_PUSHDATA2 = 0x4d;
const OP_PUSHDATA4 = 0x4e;

export const MAX_ENVELOPE_PAYLOAD = 1_000_000;

function encodePush(payload: Uint8Array): Uint8Array {
  const n = payload.length;
  if (n <= 75) {
    return concat(Uint8Array.of(n), payload);
  }
  if (n <= 0xff) {
    return concat(Uint8Array.of(OP_PUSHDATA1, n), payload);
  }
  if (n <= 0xffff) {
    return concat(Uint8Array.of(OP_PUSHDATA2, n & 0xff, (n >> 8) & 0xff), payload);
  }
  return concat(
    Uint8Array.of(OP_PUSHDATA4, n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff),
    payload,
  );
}

export function buildScriptDataEnvelope(payload: Uint8Array): Result<{ lockingScript: Script }, BsvError> {
  if (payload.length > MAX_ENVELOPE_PAYLOAD) {
    return err(envelopeOversize(MAX_ENVELOPE_PAYLOAD, payload.length));
  }
  const bytes = concat(Uint8Array.of(OP_FALSE, OP_IF), encodePush(payload), Uint8Array.of(OP_ENDIF));
  return ok({ lockingScript: scriptFromBytes(bytes) });
}

export function recognise(lockingScript: Script): Result<Uint8Array, BsvError> {
  const b = scriptToBytes(lockingScript);
  if (b.length < 3 || b[0] !== OP_FALSE || b[1] !== OP_IF) return err(envelopeNotRecognised());
  let off = 2;
  const op = b[off] as number;
  let len: number;
  if (op >= 1 && op <= 75) {
    len = op;
    off += 1;
  } else if (op === OP_PUSHDATA1) {
    if (off + 2 > b.length) return err(envelopeNotRecognised());
    len = b[off + 1] as number;
    off += 2;
  } else if (op === OP_PUSHDATA2) {
    if (off + 3 > b.length) return err(envelopeNotRecognised());
    len = (b[off + 1] as number) | ((b[off + 2] as number) << 8);
    off += 3;
  } else if (op === OP_PUSHDATA4) {
    if (off + 5 > b.length) return err(envelopeNotRecognised());
    len = ((b[off + 1] as number) | ((b[off + 2] as number) << 8) | ((b[off + 3] as number) << 16) | ((b[off + 4] as number) << 24)) >>> 0;
    off += 5;
  } else {
    return err(envelopeNotRecognised());
  }
  if (off + len + 1 > b.length) return err(envelopeNotRecognised());
  const payload = b.subarray(off, off + len);
  if (b[off + len] !== OP_ENDIF) return err(envelopeNotRecognised());
  if (off + len + 1 !== b.length) return err(envelopeNotRecognised());
  return ok(Uint8Array.from(payload));
}

// Walk a script's chunk boundaries, returning the opcodes seen (push opcodes are
// recorded; their pushed data is skipped). Used to assert no OP_RETURN opcode is
// present in any produced script.
export function scriptOpcodes(lockingScript: Script): number[] {
  const b = scriptToBytes(lockingScript);
  const ops: number[] = [];
  let off = 0;
  while (off < b.length) {
    const op = b[off] as number;
    ops.push(op);
    off += 1;
    if (op >= 1 && op <= 75) {
      off += op;
    } else if (op === OP_PUSHDATA1) {
      const n = b[off] ?? 0;
      off += 1 + n;
    } else if (op === OP_PUSHDATA2) {
      const n = (b[off] ?? 0) | ((b[off + 1] ?? 0) << 8);
      off += 2 + n;
    } else if (op === OP_PUSHDATA4) {
      const n = ((b[off] ?? 0) | ((b[off + 1] ?? 0) << 8) | ((b[off + 2] ?? 0) << 16) | ((b[off + 3] ?? 0) << 24)) >>> 0;
      off += 4 + n;
    }
  }
  return ops;
}

export function containsOpReturn(lockingScript: Script): boolean {
  return scriptOpcodes(lockingScript).includes(OP_RETURN);
}
