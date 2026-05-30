// Script: raw locking/unlocking script bytes. No opcode-policy logic beyond the
// SDK; this is a thin, validated wrapper.
import type { Result } from './result.js';
import { ok, err } from './result.js';
import type { BsvError } from './errors.js';
import { toHexLower, fromHex as bytesFromHex } from './bytes.js';

declare const ScriptBrand: unique symbol;
export type Script = Uint8Array & { readonly [ScriptBrand]: 'Script' };

export function fromBytes(bytes: Uint8Array): Script {
  return Uint8Array.from(bytes) as Script;
}

export function fromHex(hex: string): Result<Script, BsvError> {
  const parsed = bytesFromHex(hex);
  if (!parsed.ok) return err(parsed.error);
  return ok(parsed.value as Script);
}

export function toBytes(s: Script): Uint8Array {
  return Uint8Array.from(s);
}

export function toHex(s: Script): string {
  return toHexLower(s);
}

export function length(s: Script): number {
  return s.length;
}
