// Tax fields are MAPPED fields (ledgermap) within the accounting transactions.
// Amounts are bigint minor units; rates are basis points drawn from a permitted set.
import type { Result } from '@vaa/bsv';
import { ok, err } from '@vaa/bsv';
import type { AccountingTransaction } from '@vaa/evidence';
import type { FieldMap } from '@vaa/ledgermap';
import { mapField } from '@vaa/ledgermap';
import type { TaxError } from './errors.js';
import { rateNotPermitted, taxFieldNotMapped } from './errors.js';

export const TAX_TAGS = {
  code: 'tax.code',
  rate: 'tax.rate',
  output: 'tax.outputAmount',
  input: 'tax.inputAmount',
  payable: 'tax.vatPayable',
} as const;

// Permitted VAT rates in basis points (0%, 5%, 20%); extensible per jurisdiction.
export const PERMITTED_RATES_BP: number[] = [0, 500, 2000];

export function checkRate(rateBp: number): Result<void, TaxError> {
  if (!PERMITTED_RATES_BP.includes(rateBp)) return err(rateNotPermitted(rateBp));
  return ok(undefined);
}

// Read a numericValue field (version byte + 8-byte big-endian).
export function readNumericValue(value: Uint8Array): bigint | undefined {
  if (value.length !== 9) return undefined;
  let v = 0n;
  for (let i = 1; i < 9; i++) v = (v << 8n) | BigInt(value[i] as number);
  return v;
}

export interface PeriodTransaction {
  tx: AccountingTransaction;
}

// Collect the period's mapped output and input tax amounts (selective: only the
// tax fields, located by tag, each confirmed mapped under the structure root).
export function collectTaxFields(
  map: FieldMap,
  accountPath: string[],
  transactions: PeriodTransaction[],
): Result<{ outputs: bigint[]; inputs: bigint[] }, TaxError> {
  for (const tag of [TAX_TAGS.output, TAX_TAGS.input]) {
    if (!mapField(map, accountPath, tag).ok) return err(taxFieldNotMapped(tag));
  }
  const outputs: bigint[] = [];
  const inputs: bigint[] = [];
  for (const { tx } of transactions) {
    const o = tx.fields.find((f) => f.tag === TAX_TAGS.output);
    const i = tx.fields.find((f) => f.tag === TAX_TAGS.input);
    if (o !== undefined) {
      const v = readNumericValue(o.value);
      if (v !== undefined) outputs.push(v);
    }
    if (i !== undefined) {
      const v = readNumericValue(i.value);
      if (v !== undefined) inputs.push(v);
    }
  }
  return ok({ outputs, inputs });
}
