// The typed error union for the bsv package. Untrusted-input paths return these
// as Result errors; programmer misuse (only) is thrown as a BsvException
// carrying one of these values.

export type BsvError =
  | { kind: 'HashBadLength'; message: string; got: number }
  | { kind: 'HashBadHex'; message: string; reason: 'length' | 'charset' }
  | { kind: 'TxMalformed'; message: string; at: string }
  | { kind: 'TxTruncated'; message: string; neededBytes: number; gotBytes: number }
  | { kind: 'HeaderBadLength'; message: string; got: number }
  | { kind: 'ChainNotLinked'; message: string; expectedPrev: string; gotPrev: string }
  | { kind: 'ChainTargetNotMet'; message: string; headerHashDisplay: string }
  | { kind: 'EnvelopeOversize'; message: string; maxBytes: number; gotBytes: number }
  | { kind: 'EnvelopeNotRecognised'; message: string }
  | { kind: 'NodeUnreachable'; message: string; detail: string }
  | { kind: 'NodeNotFound'; message: string; what: string }
  | { kind: 'NodeBadResponse'; message: string; detail: string }
  | { kind: 'BytesOutOfRange'; message: string; offset: number; length: number; bufferLength: number };

export type BsvErrorKind = BsvError['kind'];

export function isBsvError(x: unknown): x is BsvError {
  return (
    typeof x === 'object' &&
    x !== null &&
    'kind' in x &&
    typeof (x as { kind: unknown }).kind === 'string' &&
    'message' in x &&
    typeof (x as { message: unknown }).message === 'string'
  );
}

// Constructors.
export const hashBadLength = (got: number): BsvError => ({
  kind: 'HashBadLength',
  message: `hash must be 32 bytes, got ${got}`,
  got,
});

export const hashBadHex = (reason: 'length' | 'charset'): BsvError => ({
  kind: 'HashBadHex',
  message: `bad display hex (${reason})`,
  reason,
});

export const txMalformed = (at: string): BsvError => ({
  kind: 'TxMalformed',
  message: `malformed transaction at ${at}`,
  at,
});

export const txTruncated = (neededBytes: number, gotBytes: number): BsvError => ({
  kind: 'TxTruncated',
  message: `transaction truncated: needed ${neededBytes}, got ${gotBytes}`,
  neededBytes,
  gotBytes,
});

export const headerBadLength = (got: number): BsvError => ({
  kind: 'HeaderBadLength',
  message: `header must be 80 bytes, got ${got}`,
  got,
});

export const chainNotLinked = (expectedPrev: string, gotPrev: string): BsvError => ({
  kind: 'ChainNotLinked',
  message: `header does not link: expected prev ${expectedPrev}, got ${gotPrev}`,
  expectedPrev,
  gotPrev,
});

export const chainTargetNotMet = (headerHashDisplay: string): BsvError => ({
  kind: 'ChainTargetNotMet',
  message: `header hash ${headerHashDisplay} does not meet target`,
  headerHashDisplay,
});

export const envelopeOversize = (maxBytes: number, gotBytes: number): BsvError => ({
  kind: 'EnvelopeOversize',
  message: `envelope payload ${gotBytes} exceeds maximum ${maxBytes}`,
  maxBytes,
  gotBytes,
});

export const envelopeNotRecognised = (): BsvError => ({
  kind: 'EnvelopeNotRecognised',
  message: 'script is not a recognised data envelope',
});

export const nodeUnreachable = (detail: string): BsvError => ({
  kind: 'NodeUnreachable',
  message: `node unreachable: ${detail}`,
  detail,
});

export const nodeNotFound = (what: string): BsvError => ({
  kind: 'NodeNotFound',
  message: `not found: ${what}`,
  what,
});

export const nodeBadResponse = (detail: string): BsvError => ({
  kind: 'NodeBadResponse',
  message: `bad node response: ${detail}`,
  detail,
});

export const bytesOutOfRange = (offset: number, length: number, bufferLength: number): BsvError => ({
  kind: 'BytesOutOfRange',
  message: `read of ${length} byte(s) at offset ${offset} exceeds buffer length ${bufferLength}`,
  offset,
  length,
  bufferLength,
});

// Thrown only for programmer misuse (e.g. writing a negative varint). Carries
// the typed BsvError so callers can still discriminate.
export class BsvException extends Error {
  readonly error: BsvError;
  constructor(error: BsvError) {
    super(error.message);
    this.name = 'BsvException';
    this.error = error;
  }
}

export function throwBsv(error: BsvError): never {
  throw new BsvException(error);
}
