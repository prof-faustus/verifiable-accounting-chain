// Enumerate/extract a mapped field's data across transactions (EP3420669B1
// "extract data from a plurality of transactions"). Reveals only that field.
import type { Txid } from '@vaa/bsv';
import type { AccountingTransaction } from '@vaa/evidence';
import type { FieldMap } from './map.js';
import { mapField } from './map.js';

export interface ExtractedValue {
  txid?: Txid;
  value: Uint8Array;
}

export function extractField(
  map: FieldMap,
  accountPath: string[],
  tag: string,
  transactions: { tx: AccountingTransaction; txid?: Txid }[],
): ExtractedValue[] {
  const mapped = mapField(map, accountPath, tag);
  if (!mapped.ok) return [];
  const out: ExtractedValue[] = [];
  for (const entry of transactions) {
    const field = entry.tx.fields.find((f) => f.tag === tag);
    if (field !== undefined) {
      const v: ExtractedValue = { value: Uint8Array.from(field.value) };
      if (entry.txid !== undefined) v.txid = entry.txid;
      out.push(v);
    }
  }
  return out;
}
