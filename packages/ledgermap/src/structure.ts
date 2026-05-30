// The chart-of-accounts / general-ledger structure: a tree of
// ledger -> account -> sub-account -> field. Depth and breadth are unbounded.
import type { Result } from '@vaa/bsv';
import { ok, err } from '@vaa/bsv';
import type { LedgerMapError } from './errors.js';
import { badPath } from './errors.js';

export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

export interface LedgerNode {
  path: string[];
  label: string;
  accountType?: AccountType;
  children: LedgerNode[];
  fieldTags?: string[];
}

export interface LedgerStructure {
  version: number;
  root: LedgerNode;
}

function validateNode(node: LedgerNode, parentPath: string[]): LedgerMapError | undefined {
  // path = parent path + one segment (root has [] path and is checked by caller)
  if (parentPath.length > 0 || node.path.length > 0) {
    if (node.path.length !== parentPath.length + 1) return badPath(node.path.join('/'), 'badSegment');
    for (let i = 0; i < parentPath.length; i++) if (node.path[i] !== parentPath[i]) return badPath(node.path.join('/'), 'badSegment');
    const seg = node.path[node.path.length - 1];
    if (seg === undefined || seg.length === 0) return badPath(node.path.join('/'), 'empty');
  }
  // field tags unique within the node; posting accounts (with fieldTags) carry a type
  if (node.fieldTags !== undefined && node.fieldTags.length > 0) {
    const seen = new Set<string>();
    for (const t of node.fieldTags) {
      if (t.length === 0) return badPath(node.path.join('/') + ':field', 'empty');
      if (seen.has(t)) return badPath(node.path.join('/') + ':' + t, 'duplicate');
      seen.add(t);
    }
    if (node.accountType === undefined) return badPath(node.path.join('/'), 'badSegment');
  }
  // no duplicate sibling segments
  const segs = new Set<string>();
  for (const child of node.children) {
    const seg = child.path[child.path.length - 1];
    if (seg === undefined || seg.length === 0) return badPath(child.path.join('/'), 'empty');
    if (segs.has(seg)) return badPath(child.path.join('/'), 'duplicate');
    segs.add(seg);
  }
  for (const child of node.children) {
    const e = validateNode(child, node.path);
    if (e !== undefined) return e;
  }
  return undefined;
}

export function validateStructure(s: LedgerStructure): Result<void, LedgerMapError> {
  if (s.root.path.length !== 0) return err(badPath(s.root.path.join('/'), 'badSegment'));
  const e = validateNode(s.root, []);
  if (e !== undefined) return err(e);
  return ok(undefined);
}

export function enumerateFields(s: LedgerStructure): { path: string[]; tag: string }[] {
  const out: { path: string[]; tag: string }[] = [];
  const walk = (node: LedgerNode): void => {
    if (node.fieldTags !== undefined) for (const tag of node.fieldTags) out.push({ path: node.path, tag });
    for (const child of node.children) walk(child);
  };
  walk(s.root);
  return out;
}

export function enumerateNodes(s: LedgerStructure): LedgerNode[] {
  const out: LedgerNode[] = [];
  const walk = (node: LedgerNode): void => {
    out.push(node);
    for (const child of node.children) walk(child);
  };
  walk(s.root);
  return out;
}

export function findNode(s: LedgerStructure, path: string[]): LedgerNode | undefined {
  let node: LedgerNode | undefined = s.root;
  for (let i = 0; i < path.length; i++) {
    if (node === undefined) return undefined;
    node = node.children.find((c) => c.path[c.path.length - 1] === path[i]);
  }
  return node;
}
