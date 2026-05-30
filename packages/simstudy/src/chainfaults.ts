// Unified fault matrix for Paper 3 (Part 5-P3): chain-integrity, mapping,
// triple-entry, and tax faults — each detected, zero false positives on the
// intact population.
import type { Point, Hash, Txid } from '@vaa/bsv';
import { HashOps, TxidOps, doubleSha256, HeaderChain, meetsTarget } from '@vaa/bsv';
import type { BlockHeader } from '@vaa/bsv';
import { rootFromSeed, sign as keysSign } from '@vaa/keys';
import { TransactionChain, genesisMessage, deriveHeadPriv, deriveNextPriv, linkMessage, verifyLinks } from '@vaa/chain';
import type { Link } from '@vaa/chain';
import type { LedgerStructure, FieldMap } from '@vaa/ledgermap';
import { verifyFieldUnderRoot, fieldKey, mappingRoot, verifyMappingRoot } from '@vaa/ledgermap';
import { numericValue, fieldTreeRoot } from '@vaa/evidence';
import { buildTripleEntry, verifyTripleEntry, detectUnmatched, SHARED_AMOUNT_TAG } from '@vaa/tripleentry';
import type { TripleEntry, EntrySide } from '@vaa/tripleentry';

function unwrap<T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!r.ok) throw new Error('unreachable in chainfaults');
  return r.value;
}
import { recomputeVat, verifyVatDeclaration, checkRate } from '@vaa/tax';
import type { VatPosition } from '@vaa/tax';

export type UnifiedFaultClass =
  | 'reorderedLink'
  | 'insertedLink'
  | 'droppedLink'
  | 'tamperedLinkRoot'
  | 'brokenSpendLink'
  | 'badLinkSignature'
  | 'misMappedField'
  | 'wrongMappingRoot'
  | 'unmatchedDebit'
  | 'unmatchedCredit'
  | 'sideVsSharedDivergence'
  | 'sideNotReferencingShared'
  | 'taxFigureInconsistentWithMappedFields'
  | 'rateNotPermitted';

export const UNIFIED_FAULT_CLASSES: UnifiedFaultClass[] = [
  'reorderedLink',
  'insertedLink',
  'droppedLink',
  'tamperedLinkRoot',
  'brokenSpendLink',
  'badLinkSignature',
  'misMappedField',
  'wrongMappingRoot',
  'unmatchedDebit',
  'unmatchedCredit',
  'sideVsSharedDivergence',
  'sideNotReferencingShared',
  'taxFigureInconsistentWithMappedFields',
  'rateNotPermitted',
];

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function txidAt(i: number): Txid {
  const t = new Uint8Array(32);
  t[0] = i & 0xff;
  t[2] = 0xc4;
  return unwrap(TxidOps.fromInternalBytes(t));
}
function syntheticHeaderFor(root: Hash): BlockHeader {
  let header: BlockHeader = { version: 1, prevBlockHash: HashOps.zero(), merkleRoot: root, time: 0, bits: 0x2100ffff, nonce: 0 };
  while (!meetsTarget(header)) header = { ...header, nonce: header.nonce + 1 };
  return header;
}

export interface UnifiedContext {
  chainHead: Point;
  links: Link[];
  map: FieldMap;
  structure: LedgerStructure;
  accountPath: string[];
  fieldTag: string;
  fieldKeyVal: Point;
  te: TripleEntry;
  teHeaderChain: HeaderChain;
  debitSides: EntrySide[];
  creditSides: EntrySide[];
  taxMap: FieldMap;
  taxAccountPath: string[];
  taxTxs: { tx: { kind: 'journal'; fields: { tag: string; value: Uint8Array }[] } }[];
  taxDeclared: VatPosition;
}

export function buildUnifiedContext(seedNum: number): UnifiedContext {
  const seed = enc('unified-' + seedNum);
  // chain of 6 signed, spend-linked links
  const { rootPriv, rootPub } = rootFromSeed(seed);
  const genesisMsg = genesisMessage(enc('entity'), enc('period'));
  const chain = new TransactionChain(rootPub, genesisMsg);
  const txids: Txid[] = [];
  const roots: Hash[] = [];
  const privs: bigint[] = [];
  for (let i = 0; i < 6; i++) {
    const txid = txidAt(i);
    const root = doubleSha256(enc('r' + i));
    const priv = i === 0 ? deriveHeadPriv(rootPriv, genesisMsg) : deriveNextPriv(privs[i - 1]!, linkMessage(txids[i - 1]!, roots[i - 1]!, root));
    privs.push(priv);
    const prevOutpoint = i === 0 ? undefined : { txid: txids[i - 1]!, vout: 0 };
    chain.append(txid, root, prevOutpoint, (_idx, m) => keysSign(priv, m));
    txids.push(txid);
    roots.push(root);
  }

  // mapping
  const structure: LedgerStructure = {
    version: 1,
    root: { path: [], label: 'E', children: [{ path: ['GL'], label: 'GL', children: [{ path: ['GL', 'A'], label: 'A', accountType: 'asset', children: [], fieldTags: ['net', 'tax'] }] }] },
  };
  const map: FieldMap = { structure, rootPub };
  const accountPath = ['GL', 'A'];
  const fieldTag = 'net';
  const fieldKeyVal = fieldKey(map, accountPath, fieldTag).ok ? (fieldKey(map, accountPath, fieldTag) as { ok: true; value: Point }).value : rootPub;

  // triple entry
  const sharedTx = { kind: 'journal' as const, fields: [{ tag: SHARED_AMOUNT_TAG, value: numericValue(100n) }] };
  const sharedRoot = (fieldTreeRoot(sharedTx) as { ok: true; value: Hash }).value;
  const sharedTxid = txidAt(50);
  const teResult = buildTripleEntry({
    debitParty: 'B',
    creditParty: 'S',
    debitPostings: [{ type: 'ledgerEntry', id: 'd', account: '1000', debit: 100n, credit: 0n }],
    creditPostings: [{ type: 'ledgerEntry', id: 'c', account: '4000', debit: 0n, credit: 100n }],
    sharedTx,
    sharedFieldTreeRoot: sharedRoot,
    sharedTxid,
    sharedVout: 0,
  });
  const te = (teResult as { ok: true; value: TripleEntry }).value;
  const teHeaderChain = new HeaderChain();
  teHeaderChain.add(syntheticHeaderFor(sharedRoot));

  // a second triple entry whose credit side is missing (for unmatched detection)
  const sharedTx2 = { kind: 'journal' as const, fields: [{ tag: SHARED_AMOUNT_TAG, value: numericValue(50n) }] };
  const te2 = (buildTripleEntry({
    debitParty: 'B',
    creditParty: 'S',
    debitPostings: [{ type: 'ledgerEntry', id: 'd2', account: '1000', debit: 50n, credit: 0n }],
    creditPostings: [{ type: 'ledgerEntry', id: 'c2', account: '4000', debit: 0n, credit: 50n }],
    sharedTx: sharedTx2,
    sharedFieldTreeRoot: (fieldTreeRoot(sharedTx2) as { ok: true; value: Hash }).value,
    sharedTxid: txidAt(51),
    sharedVout: 0,
  }) as { ok: true; value: TripleEntry }).value;
  const debitSides = [te.debitSide, te2.debitSide];
  const creditSides = [te.creditSide]; // te2's credit missing

  // tax
  const taxStructure: LedgerStructure = {
    version: 1,
    root: { path: [], label: 'E', children: [{ path: ['GL'], label: 'GL', children: [{ path: ['GL', 'VAT'], label: 'VAT', accountType: 'liability', children: [], fieldTags: ['tax.outputAmount', 'tax.inputAmount'] }] }] },
  };
  const taxMap: FieldMap = { structure: taxStructure, rootPub };
  const taxAccountPath = ['GL', 'VAT'];
  const taxTxs = [{ tx: { kind: 'journal' as const, fields: [{ tag: 'tax.outputAmount', value: numericValue(200n) }, { tag: 'tax.inputAmount', value: numericValue(80n) }] } }];
  const taxDeclared: VatPosition = (recomputeVat(taxMap, taxAccountPath, taxTxs) as { ok: true; value: VatPosition }).value;

  return {
    chainHead: chain.head(),
    links: [...chain.links()] as Link[],
    map,
    structure,
    accountPath,
    fieldTag,
    fieldKeyVal,
    te,
    teHeaderChain,
    debitSides,
    creditSides,
    taxMap,
    taxAccountPath,
    taxTxs,
    taxDeclared,
  };
}

function flipHash(h: Hash): Hash {
  const b = HashOps.toInternalBytes(h);
  b[0] = (b[0]! ^ 0xff) & 0xff;
  return unwrap(HashOps.fromInternalBytes(b));
}

// Returns true if the fault is DETECTED.
export function detectUnifiedFault(ctx: UnifiedContext, cls: UnifiedFaultClass): boolean {
  const links = ctx.links;
  switch (cls) {
    case 'reorderedLink': {
      const r = links.slice();
      [r[2], r[3]] = [r[3]!, r[2]!];
      return !verifyLinks(ctx.chainHead, r).ok;
    }
    case 'insertedLink':
      return !verifyLinks(ctx.chainHead, links.slice(0, 3).concat([links[2]!], links.slice(3))).ok;
    case 'droppedLink':
      return !verifyLinks(ctx.chainHead, links.slice(0, 3).concat(links.slice(4))).ok;
    case 'tamperedLinkRoot': {
      const r = links.map((l) => ({ ...l }));
      r[3] = { ...links[3]!, fieldRoot: flipHash(links[3]!.fieldRoot) };
      return !verifyLinks(ctx.chainHead, r).ok;
    }
    case 'brokenSpendLink': {
      const r = links.map((l) => ({ ...l }));
      r[3] = { ...links[3]!, prevOutpoint: { txid: txidAt(99), vout: 0 } };
      return !verifyLinks(ctx.chainHead, r).ok;
    }
    case 'badLinkSignature': {
      const r = links.map((l) => ({ ...l }));
      const sig = Uint8Array.from(links[3]!.signature);
      sig[sig.length - 1] = ((sig[sig.length - 1] ?? 0) ^ 0xff) & 0xff;
      r[3] = { ...links[3]!, signature: sig };
      return !verifyLinks(ctx.chainHead, r).ok;
    }
    case 'misMappedField':
      return !verifyFieldUnderRoot(ctx.map, ctx.accountPath, 'tax', ctx.fieldKeyVal).ok; // wrong tag for the key
    case 'wrongMappingRoot':
      return !verifyMappingRoot(ctx.structure, flipHash(mappingRoot(ctx.structure))).ok;
    case 'unmatchedDebit':
      return detectUnmatched(ctx.debitSides, ctx.creditSides).unmatchedDebits.length > 0;
    case 'unmatchedCredit': {
      // a credit with no matching debit (references a shared entry no debit points to)
      const credits = [ctx.te.creditSide, { ...ctx.te.creditSide, sharedEntryRef: { txid: txidAt(77), vout: 0 } } as EntrySide];
      return detectUnmatched([ctx.te.debitSide], credits).unmatchedCredits.length > 0;
    }
    case 'sideVsSharedDivergence': {
      const tampered = { ...ctx.te, debitSide: { ...ctx.te.debitSide, postings: [{ type: 'ledgerEntry' as const, id: 'd', account: '1000', debit: 90n, credit: 0n }] }, creditSide: { ...ctx.te.creditSide, postings: [{ type: 'ledgerEntry' as const, id: 'c', account: '4000', debit: 0n, credit: 90n }] } };
      return !verifyTripleEntry(tampered, ctx.teHeaderChain).ok;
    }
    case 'sideNotReferencingShared': {
      const tampered = { ...ctx.te, debitSide: { ...ctx.te.debitSide, sharedEntryRef: { txid: txidAt(88), vout: 0 } } };
      return !verifyTripleEntry(tampered, ctx.teHeaderChain).ok;
    }
    case 'taxFigureInconsistentWithMappedFields':
      return !verifyVatDeclaration(ctx.taxMap, ctx.taxAccountPath, ctx.taxTxs, { outputTax: 999n, inputTax: 0n, payable: 999n }).ok;
    case 'rateNotPermitted':
      return !checkRate(1234).ok;
  }
}

// The intact scenario must pass every check (zero false positives).
export function unifiedFalsePositives(ctx: UnifiedContext): number {
  let fp = 0;
  if (!verifyLinks(ctx.chainHead, ctx.links).ok) fp++;
  if (!verifyFieldUnderRoot(ctx.map, ctx.accountPath, ctx.fieldTag, ctx.fieldKeyVal).ok) fp++;
  if (!verifyMappingRoot(ctx.structure, mappingRoot(ctx.structure)).ok) fp++;
  if (!verifyTripleEntry(ctx.te, ctx.teHeaderChain).ok) fp++;
  if (!verifyVatDeclaration(ctx.taxMap, ctx.taxAccountPath, ctx.taxTxs, ctx.taxDeclared).ok) fp++;
  return fp;
}
