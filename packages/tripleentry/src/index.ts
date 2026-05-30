// Public surface of @vaa/tripleentry.
export type { TripleEntryError, TripleEntryVerifyReason } from './errors.js';
export { unbalancedEntry, sideMismatch, sharedEntryNotReferenced, notAnchored, schemaInvalid } from './errors.js';

export type { EntrySide, SharedEntry, TripleEntry, TripleEntryEvent } from './entry.js';
export { buildTripleEntry, sumDebit, sumCredit } from './entry.js';

export { verifyTripleEntry, detectUnmatched, SHARED_AMOUNT_TAG } from './reconcile.js';
