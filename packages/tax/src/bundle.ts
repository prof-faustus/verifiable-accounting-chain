// The tax-assertion bundle (for the tax authority): reveals only the tax figures
// and proves inclusion + mapping + chain + anchor + recompute.
import type { Point, Hash, VerifyResult, HeaderChain, Result } from '@vaa/bsv';
import { ok, err, verifyOk, verifyFail } from '@vaa/bsv';
import type { AccountingTransaction } from '@vaa/evidence';
import type { TransactionChain } from '@vaa/chain';
import type { FieldMap } from '@vaa/ledgermap';
import { mapField } from '@vaa/ledgermap';
import type { ProofBundle, NodeContext } from '@vaa/bundle';
import { issueBundle, verifyBundle } from '@vaa/bundle';
import type { TaxError, TaxVerifyReason } from './errors.js';
import { schemaInvalid, taxFieldNotMapped } from './errors.js';
import { TAX_TAGS, readNumericValue } from './fields.js';
import type { VatPosition } from './vat.js';

export function issueTaxBundle(
  taxTx: AccountingTransaction,
  measureTags: string[],
  chain: TransactionChain,
  chainIndex: number,
  nodeCtx: NodeContext,
): Result<ProofBundle, TaxError> {
  const indices: number[] = [];
  for (const tag of measureTags) {
    const idx = taxTx.fields.findIndex((f) => f.tag === tag);
    if (idx < 0) return err(taxFieldNotMapped(tag));
    indices.push(idx);
  }
  const bundle = issueBundle(taxTx, indices, chain, chainIndex, nodeCtx);
  if (!bundle.ok) return err(schemaInvalid('bundle'));
  return ok(bundle.value);
}

export function verifyTaxBundle(
  rootPub: Point,
  genesisMsg: Hash,
  headerChain: HeaderChain,
  map: FieldMap,
  accountPath: string[],
  bundle: ProofBundle,
  declared: VatPosition,
): VerifyResult<TaxVerifyReason> {
  // (1) the underlying bundle: inclusion + chain + anchor
  const v = verifyBundle(rootPub, genesisMsg, headerChain, bundle);
  if (!v.ok) return verifyFail({ kind: 'BundleInvalid', reason: v.reason.kind });

  // (2) each disclosed tax field maps under the structure root
  for (const field of bundle.disclosedFields) {
    if (!mapField(map, accountPath, field.tag).ok) return verifyFail({ kind: 'MappingInvalid', tag: field.tag });
  }

  // (3) the disclosed tax figures recompute to the declaration
  const find = (tag: string) => bundle.disclosedFields.find((f) => f.tag === tag);
  const o = find(TAX_TAGS.output);
  const i = find(TAX_TAGS.input);
  if (o !== undefined && i !== undefined) {
    const ov = readNumericValue(o.value);
    const iv = readNumericValue(i.value);
    if (ov === undefined || iv === undefined) return verifyFail({ kind: 'TaxRecomputeMismatch', measure: 'parse', computed: '0', declared: '0' });
    const payable = ov - iv;
    if (declared.outputTax !== ov) return verifyFail({ kind: 'TaxRecomputeMismatch', measure: 'outputTax', computed: ov.toString(), declared: declared.outputTax.toString() });
    if (declared.inputTax !== iv) return verifyFail({ kind: 'TaxRecomputeMismatch', measure: 'inputTax', computed: iv.toString(), declared: declared.inputTax.toString() });
    if (declared.payable !== payable) return verifyFail({ kind: 'TaxRecomputeMismatch', measure: 'payable', computed: payable.toString(), declared: declared.payable.toString() });
  }
  const p = find(TAX_TAGS.payable);
  if (p !== undefined) {
    const pv = readNumericValue(p.value);
    if (pv === undefined || pv !== declared.payable) return verifyFail({ kind: 'TaxRecomputeMismatch', measure: 'payable', computed: (pv ?? 0n).toString(), declared: declared.payable.toString() });
  }
  return verifyOk();
}
