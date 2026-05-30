// IndexKey (Selective Verification claims 5-6). A canonical, collision-free key
// for addressing a stored proof.
import type { Txid, Script, Result } from '@vaa/bsv';
import { TxidOps, ScriptOps, toHexLower, ok, err } from '@vaa/bsv';
import type { StoreError } from './errors.js';
import { keyError } from './errors.js';

export type Direction = 'input' | 'output';

export interface IndexKey {
  txid: Txid;
  direction: Direction;
  position: number;
  blockPosition: number;
  lockingScript?: Script;
  unlockingScript?: Script;
  amountMinorUnits?: bigint;
}

export function validateKey(k: IndexKey): Result<void, StoreError> {
  if (k.position < 0) return err(keyError('negativePosition'));
  if (k.blockPosition < 0) return err(keyError('negativeBlockPosition'));
  if (k.amountMinorUnits !== undefined && k.amountMinorUnits < 0n) return err(keyError('negativeAmount'));
  return ok(undefined);
}

function u32hex(n: number): string {
  return (n >>> 0).toString(16).padStart(8, '0');
}

function scriptPart(s: Script | undefined): string {
  if (s === undefined) return '-';
  const hex = ScriptOps.toHex(s);
  return `${ScriptOps.length(s)}:${hex}`;
}

export function serializeKey(k: IndexKey): string {
  const parts: string[] = [];
  parts.push('t:' + toHexLower(TxidOps.toInternalBytes(k.txid)));
  parts.push('d:' + (k.direction === 'input' ? '0' : '1'));
  parts.push('p:' + u32hex(k.position));
  parts.push('b:' + u32hex(k.blockPosition));
  parts.push('l:' + scriptPart(k.lockingScript));
  parts.push('u:' + scriptPart(k.unlockingScript));
  parts.push('a:' + (k.amountMinorUnits !== undefined ? k.amountMinorUnits.toString(16) : '-'));
  return parts.join('|');
}
