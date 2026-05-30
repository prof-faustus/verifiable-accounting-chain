// Request schema validation at the boundary. Each validator parses untrusted
// JSON into a typed domain object or returns a typed BadRequest naming the field.
import type { Hash, Txid, Script, Result } from '@vaa/bsv';
import { HashOps, TxidOps, ScriptOps, fromHex, ok, err } from '@vaa/bsv';
import type { MerkleProof } from '@vaa/merkle';
import type { IndexKey, Direction, StoredProof, ProofShard } from '@vaa/proofstore';
import type { AccountingTransaction, AccountingKind, AccountingField } from '@vaa/evidence';
import type { ApiError } from './errors.js';
import { badRequest } from './errors.js';

function obj(x: unknown): Record<string, unknown> | undefined {
  return typeof x === 'object' && x !== null && !Array.isArray(x) ? (x as Record<string, unknown>) : undefined;
}

function reqInt(o: Record<string, unknown>, k: string): Result<number, ApiError> {
  const v = o[k];
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) return err(badRequest(k, 'must be a non-negative integer'));
  return ok(v);
}

function hashField(k: string, hex: unknown): Result<Hash, ApiError> {
  if (typeof hex !== 'string') return err(badRequest(k, 'must be a hex string'));
  const h = HashOps.fromDisplayHex(hex);
  if (!h.ok) return err(badRequest(k, 'is not a 32-byte display hex'));
  return ok(h.value);
}

const KINDS: AccountingKind[] = ['invoice', 'journal', 'ledgerPosting', 'reconciliation', 'statementLines'];

export interface ParsedAnchor {
  tx: AccountingTransaction;
}

export function parseAnchorRequest(body: unknown): Result<ParsedAnchor, ApiError> {
  const o = obj(body);
  if (o === undefined) return err(badRequest('body', 'must be an object'));
  const txo = obj(o['accountingTransaction']);
  if (txo === undefined) return err(badRequest('accountingTransaction', 'must be an object'));
  const kind = txo['kind'];
  if (typeof kind !== 'string' || !KINDS.includes(kind as AccountingKind)) return err(badRequest('kind', 'is not a valid accounting kind'));
  const rawFields = txo['fields'];
  if (!Array.isArray(rawFields) || rawFields.length === 0) return err(badRequest('fields', 'must be a non-empty array'));
  const fields: AccountingField[] = [];
  for (let i = 0; i < rawFields.length; i++) {
    const fo = obj(rawFields[i]);
    if (fo === undefined) return err(badRequest(`fields[${i}]`, 'must be an object'));
    const tag = fo['tag'];
    const valueHex = fo['valueHex'];
    if (typeof tag !== 'string') return err(badRequest(`fields[${i}].tag`, 'must be a string'));
    if (typeof valueHex !== 'string') return err(badRequest(`fields[${i}].valueHex`, 'must be a hex string'));
    const v = fromHex(valueHex);
    if (!v.ok) return err(badRequest(`fields[${i}].valueHex`, 'is not valid hex'));
    fields.push({ tag, value: v.value });
  }
  return ok({ tx: { kind: kind as AccountingKind, fields } });
}

export interface ParsedProve {
  leaves: Hash[];
  index: number;
}

export function parseProveRequest(body: unknown): Result<ParsedProve, ApiError> {
  const o = obj(body);
  if (o === undefined) return err(badRequest('body', 'must be an object'));
  const raw = o['leavesHex'];
  if (!Array.isArray(raw) || raw.length === 0) return err(badRequest('leavesHex', 'must be a non-empty array'));
  const leaves: Hash[] = [];
  for (let i = 0; i < raw.length; i++) {
    const h = hashField(`leavesHex[${i}]`, raw[i]);
    if (!h.ok) return err(h.error);
    leaves.push(h.value);
  }
  const index = reqInt(o, 'index');
  if (!index.ok) return err(index.error);
  if (index.value >= leaves.length) return err(badRequest('index', 'is out of range'));
  return ok({ leaves, index: index.value });
}

function parseDirection(v: unknown): Direction | undefined {
  return v === 'input' || v === 'output' ? v : undefined;
}

function optionalScript(k: string, v: unknown): Result<Script | undefined, ApiError> {
  if (v === undefined) return ok(undefined);
  if (typeof v !== 'string') return err(badRequest(k, 'must be a hex string'));
  const s = ScriptOps.fromHex(v);
  if (!s.ok) return err(badRequest(k, 'is not valid hex'));
  return ok(s.value);
}

export function parseIndexKey(prefix: string, x: unknown): Result<IndexKey, ApiError> {
  const o = obj(x);
  if (o === undefined) return err(badRequest(prefix, 'must be an object'));
  const txidHex = o['txidHex'];
  if (typeof txidHex !== 'string') return err(badRequest(`${prefix}.txidHex`, 'must be a hex string'));
  const txid: Result<Txid, ApiError> = (() => {
    const t = TxidOps.fromDisplayHex(txidHex);
    return t.ok ? ok(t.value) : err(badRequest(`${prefix}.txidHex`, 'is not a 32-byte txid'));
  })();
  if (!txid.ok) return err(txid.error);
  const direction = parseDirection(o['direction']);
  if (direction === undefined) return err(badRequest(`${prefix}.direction`, 'must be "input" or "output"'));
  const position = reqInt(o, 'position');
  if (!position.ok) return err(badRequest(`${prefix}.position`, 'must be a non-negative integer'));
  const blockPosition = reqInt(o, 'blockPosition');
  if (!blockPosition.ok) return err(badRequest(`${prefix}.blockPosition`, 'must be a non-negative integer'));
  const lock = optionalScript(`${prefix}.lockingScriptHex`, o['lockingScriptHex']);
  if (!lock.ok) return err(lock.error);
  const unlock = optionalScript(`${prefix}.unlockingScriptHex`, o['unlockingScriptHex']);
  if (!unlock.ok) return err(unlock.error);
  const key: IndexKey = { txid: txid.value, direction, position: position.value, blockPosition: blockPosition.value };
  if (lock.value !== undefined) key.lockingScript = lock.value;
  if (unlock.value !== undefined) key.unlockingScript = unlock.value;
  if (typeof o['amountMinorUnits'] === 'string') {
    try {
      key.amountMinorUnits = BigInt(o['amountMinorUnits']);
    } catch {
      return err(badRequest(`${prefix}.amountMinorUnits`, 'is not an integer string'));
    }
  }
  return ok(key);
}

export interface ParsedQuery {
  key: IndexKey;
}

export function parseQueryRequest(body: unknown): Result<ParsedQuery, ApiError> {
  const o = obj(body);
  if (o === undefined) return err(badRequest('body', 'must be an object'));
  const key = parseIndexKey('key', o['key']);
  if (!key.ok) return err(key.error);
  return ok({ key: key.value });
}

function parseShards(x: unknown): Result<ProofShard[], ApiError> {
  if (!Array.isArray(x)) return err(badRequest('stored.shards', 'must be an array'));
  const shards: ProofShard[] = [];
  for (let i = 0; i < x.length; i++) {
    const so = obj(x[i]);
    if (so === undefined) return err(badRequest(`stored.shards[${i}]`, 'must be an object'));
    const from = reqInt(so, 'fromLevel');
    const to = reqInt(so, 'toLevel');
    if (!from.ok) return err(from.error);
    if (!to.ok) return err(to.error);
    const sibsRaw = so['siblingsHex'];
    if (!Array.isArray(sibsRaw)) return err(badRequest(`stored.shards[${i}].siblingsHex`, 'must be an array'));
    const siblings: Hash[] = [];
    for (let j = 0; j < sibsRaw.length; j++) {
      const h = hashField(`stored.shards[${i}].siblingsHex[${j}]`, sibsRaw[j]);
      if (!h.ok) return err(h.error);
      siblings.push(h.value);
    }
    shards.push({ fromLevel: from.value, toLevel: to.value, siblings });
  }
  return ok(shards);
}

export interface ParsedVerify {
  leaf: Hash;
  root: Hash;
  proof: MerkleProof;
  stored: StoredProof;
  mode: 'adversarial' | 'trustedOperational';
}

export function parseVerifyRequest(body: unknown): Result<ParsedVerify, ApiError> {
  const o = obj(body);
  if (o === undefined) return err(badRequest('body', 'must be an object'));
  const leaf = hashField('leafHex', o['leafHex']);
  if (!leaf.ok) return err(leaf.error);
  const root = hashField('rootHex', o['rootHex']);
  if (!root.ok) return err(root.error);
  const po = obj(o['proof']);
  if (po === undefined) return err(badRequest('proof', 'must be an object'));
  const index = reqInt(po, 'index');
  if (!index.ok) return err(index.error);
  const sibsRaw = po['siblingsHex'];
  if (!Array.isArray(sibsRaw)) return err(badRequest('proof.siblingsHex', 'must be an array'));
  const siblings: Hash[] = [];
  for (let j = 0; j < sibsRaw.length; j++) {
    const h = hashField(`proof.siblingsHex[${j}]`, sibsRaw[j]);
    if (!h.ok) return err(h.error);
    siblings.push(h.value);
  }
  const storedObj = obj(o['stored']);
  if (storedObj === undefined) return err(badRequest('stored', 'must be an object'));
  const key = parseIndexKey('stored.key', storedObj['key']);
  if (!key.ok) return err(key.error);
  const leafIndex = reqInt(storedObj, 'leafIndex');
  if (!leafIndex.ok) return err(leafIndex.error);
  const shards = parseShards(storedObj['shards']);
  if (!shards.ok) return err(shards.error);
  const expectedRoot = hashField('stored.expectedRootHex', storedObj['expectedRootHex']);
  if (!expectedRoot.ok) return err(expectedRoot.error);
  const modeRaw = o['mode'];
  const mode: 'adversarial' | 'trustedOperational' = modeRaw === 'trustedOperational' ? 'trustedOperational' : 'adversarial';
  return ok({
    leaf: leaf.value,
    root: root.value,
    proof: { index: index.value, siblings },
    stored: { key: key.value, leafIndex: leafIndex.value, shards: shards.value, expectedRoot: expectedRoot.value },
    mode,
  });
}
