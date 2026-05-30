// Tax recomputation over the period's mapped tax fields (the same recomputation
// discipline as evidence.checkVat, applied across the chained transactions).
import type { Result, VerifyResult } from '@vaa/bsv';
import { verifyOk, verifyFail } from '@vaa/bsv';
import type { FieldMap } from '@vaa/ledgermap';
import type { TaxError, TaxVerifyReason } from './errors.js';
import type { PeriodTransaction } from './fields.js';
import { collectTaxFields } from './fields.js';

export interface VatPosition {
  outputTax: bigint;
  inputTax: bigint;
  payable: bigint;
}

function sum(xs: bigint[]): bigint {
  return xs.reduce((a, x) => a + x, 0n);
}

export function recomputeVat(map: FieldMap, accountPath: string[], transactions: PeriodTransaction[]): Result<VatPosition, TaxError> {
  const collected = collectTaxFields(map, accountPath, transactions);
  if (!collected.ok) return collected;
  const outputTax = sum(collected.value.outputs);
  const inputTax = sum(collected.value.inputs);
  return { ok: true, value: { outputTax, inputTax, payable: outputTax - inputTax } };
}

export function verifyVatDeclaration(
  map: FieldMap,
  accountPath: string[],
  transactions: PeriodTransaction[],
  declared: VatPosition,
): VerifyResult<TaxVerifyReason> {
  const computed = recomputeVat(map, accountPath, transactions);
  if (!computed.ok) return verifyFail({ kind: 'MappingInvalid', tag: computed.error.kind });
  const c = computed.value;
  if (c.outputTax !== declared.outputTax) return verifyFail({ kind: 'TaxRecomputeMismatch', measure: 'outputTax', computed: c.outputTax.toString(), declared: declared.outputTax.toString() });
  if (c.inputTax !== declared.inputTax) return verifyFail({ kind: 'TaxRecomputeMismatch', measure: 'inputTax', computed: c.inputTax.toString(), declared: declared.inputTax.toString() });
  if (c.payable !== declared.payable) return verifyFail({ kind: 'TaxRecomputeMismatch', measure: 'payable', computed: c.payable.toString(), declared: declared.payable.toString() });
  return verifyOk();
}
