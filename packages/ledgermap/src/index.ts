// Public surface of @vaa/ledgermap (the field map; EP3420669B1).
export type { LedgerMapError, LedgerMapVerifyReason } from './errors.js';
export { badPath, unknownNode, notUnderRoot, mappingVersionMismatch, fieldNotMapped } from './errors.js';

export type { AccountType, LedgerNode, LedgerStructure } from './structure.js';
export { validateStructure, enumerateFields, enumerateNodes, findNode } from './structure.js';

export type { FieldMap } from './map.js';
export { ledgerPathToKey, fieldKey, mapField, verifyFieldUnderRoot } from './map.js';

export { serializeStructure, mappingRoot, verifyMappingRoot } from './commit.js';

export type { ExtractedValue } from './extract.js';
export { extractField } from './extract.js';
