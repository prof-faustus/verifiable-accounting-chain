// The versioned mapping ROOT: the chart of accounts in force for a period is part
// of the evidence. Carried on-chain via the MAPPING-ROOT item (never OP_RETURN).
import type { Hash, VerifyResult } from '@vaa/bsv';
import { doubleSha256, concat, HashOps, verifyOk, verifyFail } from '@vaa/bsv';
import type { LedgerStructure, LedgerNode, AccountType } from './structure.js';
import { enumerateNodes } from './structure.js';

const enc = new TextEncoder();

function u32(n: number): Uint8Array {
  return Uint8Array.of((n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
}
function vstr(s: string): Uint8Array {
  const b = enc.encode(s);
  return concat(u32(b.length), b);
}
const TYPE_CODE: Record<AccountType, number> = { asset: 1, liability: 2, equity: 3, income: 4, expense: 5 };

function nodeBytes(node: LedgerNode): Uint8Array {
  const parts: Uint8Array[] = [vstr(node.path.join('/')), vstr(node.label), Uint8Array.of(node.accountType ? TYPE_CODE[node.accountType] : 0)];
  const tags = node.fieldTags ?? [];
  parts.push(u32(tags.length));
  for (const t of tags) parts.push(vstr(t));
  return concat(...parts);
}

export function serializeStructure(s: LedgerStructure): Uint8Array {
  const parts: Uint8Array[] = [u32(s.version)];
  for (const node of enumerateNodes(s)) parts.push(nodeBytes(node));
  return concat(...parts);
}

export function mappingRoot(s: LedgerStructure): Hash {
  return doubleSha256(serializeStructure(s));
}

export function verifyMappingRoot(s: LedgerStructure, root: Hash): VerifyResult<{ kind: 'MappingRootMismatch' }> {
  return HashOps.equals(mappingRoot(s), root) ? verifyOk() : verifyFail({ kind: 'MappingRootMismatch' });
}
