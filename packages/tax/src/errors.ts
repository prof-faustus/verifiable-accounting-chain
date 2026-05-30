// Typed errors and verification reasons for the tax package.
export type TaxError =
  | { kind: 'TaxFieldNotMapped'; message: string; tag: string }
  | { kind: 'TaxRecomputeMismatch'; message: string; measure: string; computed: string; declared: string }
  | { kind: 'RateNotPermitted'; message: string; rate: string }
  | { kind: 'SchemaInvalid'; message: string; field: string };

export const taxFieldNotMapped = (tag: string): TaxError => ({ kind: 'TaxFieldNotMapped', message: `tax field not mapped: ${tag}`, tag });
export const taxRecomputeMismatch = (measure: string, computed: bigint, declared: bigint): TaxError => ({ kind: 'TaxRecomputeMismatch', message: `${measure}: computed ${computed} != declared ${declared}`, measure, computed: computed.toString(), declared: declared.toString() });
export const rateNotPermitted = (rate: number): TaxError => ({ kind: 'RateNotPermitted', message: `rate not permitted: ${rate}`, rate: rate.toString() });
export const schemaInvalid = (field: string): TaxError => ({ kind: 'SchemaInvalid', message: `invalid ${field}`, field });

export type TaxVerifyReason =
  | { kind: 'BundleInvalid'; reason: string }
  | { kind: 'MappingInvalid'; tag: string }
  | { kind: 'TaxRecomputeMismatch'; measure: string; computed: string; declared: string };
