// Field -> path -> key mapping (EP3420669B1 root-key -> sub-key derivation).
import type { Point, Result, VerifyResult } from '@vaa/bsv';
import { ok, err, pointEq, verifyOk, verifyFail } from '@vaa/bsv';
import { derivePathPub } from '@vaa/keys';
import type { LedgerStructure } from './structure.js';
import { findNode } from './structure.js';
import type { LedgerMapError, LedgerMapVerifyReason } from './errors.js';
import { fieldNotMapped } from './errors.js';

export interface FieldMap {
  structure: LedgerStructure;
  rootPub: Point;
}

function fieldSegment(tag: string): string {
  return 'field:' + tag;
}

export function ledgerPathToKey(map: FieldMap, path: string[]): Result<Point, LedgerMapError> {
  const derived = derivePathPub(map.rootPub, path);
  if (!derived.ok) return err(fieldNotMapped(path.join('/')));
  return ok(derived.value);
}

export function fieldKey(map: FieldMap, accountPath: string[], tag: string): Result<Point, LedgerMapError> {
  return ledgerPathToKey(map, [...accountPath, fieldSegment(tag)]);
}

export function mapField(map: FieldMap, accountPath: string[], tag: string): Result<{ path: string[]; key: Point }, LedgerMapError> {
  const node = findNode(map.structure, accountPath);
  if (node === undefined || node.fieldTags === undefined || !node.fieldTags.includes(tag)) {
    return err(fieldNotMapped(tag));
  }
  const key = fieldKey(map, accountPath, tag);
  if (!key.ok) return err(key.error);
  return ok({ path: [...accountPath, fieldSegment(tag)], key: key.value });
}

export function verifyFieldUnderRoot(map: FieldMap, accountPath: string[], tag: string, claimedKey: Point): VerifyResult<LedgerMapVerifyReason> {
  const key = fieldKey(map, accountPath, tag);
  if (!key.ok) return verifyFail({ kind: 'NotUnderRoot', path: [...accountPath, fieldSegment(tag)].join('/') });
  if (!pointEq(key.value, claimedKey)) return verifyFail({ kind: 'NotUnderRoot', path: [...accountPath, fieldSegment(tag)].join('/') });
  return verifyOk();
}
