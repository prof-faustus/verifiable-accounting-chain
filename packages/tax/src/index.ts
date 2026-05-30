// Public surface of @vaa/tax.
export type { TaxError, TaxVerifyReason } from './errors.js';
export { taxFieldNotMapped, taxRecomputeMismatch, rateNotPermitted, schemaInvalid } from './errors.js';

export type { PeriodTransaction } from './fields.js';
export { TAX_TAGS, PERMITTED_RATES_BP, checkRate, readNumericValue, collectTaxFields } from './fields.js';

export type { VatPosition } from './vat.js';
export { recomputeVat, verifyVatDeclaration } from './vat.js';

export { issueTaxBundle, verifyTaxBundle } from './bundle.js';
