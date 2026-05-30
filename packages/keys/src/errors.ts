// Typed errors and verification reasons for the keys package (Pillar 1).
export type KeysError =
  | { kind: 'BadPathSegment'; message: string; segment: string }
  | { kind: 'DerivationOutOfRange'; message: string }
  | { kind: 'NotUnderRoot'; message: string }
  | { kind: 'BadSignature'; message: string }
  | { kind: 'SchemaInvalid'; message: string; field: string };

export const badPathSegment = (segment: string): KeysError => ({
  kind: 'BadPathSegment',
  message: `bad path segment: ${JSON.stringify(segment)}`,
  segment,
});
export const derivationOutOfRange = (): KeysError => ({
  kind: 'DerivationOutOfRange',
  message: 'derived scalar is zero (out of range)',
});
export const notUnderRoot = (): KeysError => ({ kind: 'NotUnderRoot', message: 'key is not under the published root' });
export const badSignature = (): KeysError => ({ kind: 'BadSignature', message: 'signature did not verify' });
export const schemaInvalid = (field: string): KeysError => ({ kind: 'SchemaInvalid', message: `invalid ${field}`, field });

export type KeysVerifyReason = { kind: 'NotUnderRoot' } | { kind: 'BadSignature' };
