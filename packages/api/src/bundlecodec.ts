// JSON codec for the auditor proof bundle, so a bundle can be issued by the
// service and verified independently by an auditor.
import type { Hash, Txid, Point, Result } from '@vaa/bsv';
import { HashOps, TxidOps, toHexLower, fromHex, pointToHex, pointFromHex, ok, err } from '@vaa/bsv';
import type { MerkleProof } from '@vaa/merkle';
import type { ChainLinkProof, Outpoint } from '@vaa/chain';
import type { ProofBundle } from '@vaa/bundle';

function hashHex(h: Hash): string {
  return HashOps.toDisplayHex(h);
}
function txidHexOf(t: Txid): string {
  return TxidOps.toDisplayHex(t);
}

function hashFrom(hex: unknown): Hash | undefined {
  if (typeof hex !== 'string') return undefined;
  const r = HashOps.fromDisplayHex(hex);
  return r.ok ? r.value : undefined;
}
function txidFrom(hex: unknown): Txid | undefined {
  if (typeof hex !== 'string') return undefined;
  const r = TxidOps.fromDisplayHex(hex);
  return r.ok ? r.value : undefined;
}
function pointFrom(hex: unknown): Point | undefined {
  if (typeof hex !== 'string') return undefined;
  const r = pointFromHex(hex);
  return r.ok ? r.value : undefined;
}
function bytesFrom(hex: unknown): Uint8Array | undefined {
  if (typeof hex !== 'string') return undefined;
  const r = fromHex(hex);
  return r.ok ? r.value : undefined;
}

function merkleProofToJson(p: MerkleProof): { index: number; siblingsHex: string[] } {
  return { index: p.index, siblingsHex: p.siblings.map((s) => hashHex(s)) };
}

function chainLinkProofToJson(p: ChainLinkProof): Record<string, unknown> {
  const j: Record<string, unknown> = {
    index: p.index,
    txidHex: txidHexOf(p.txid),
    fieldRootHex: hashHex(p.fieldRoot),
    linkPubHex: pointToHex(p.linkPub),
    signatureHex: toHexLower(p.signature),
  };
  if (p.prevTxid !== undefined) j['prevTxidHex'] = txidHexOf(p.prevTxid);
  if (p.prevFieldRoot !== undefined) j['prevFieldRootHex'] = hashHex(p.prevFieldRoot);
  if (p.prevLinkPub !== undefined) j['prevLinkPubHex'] = pointToHex(p.prevLinkPub);
  if (p.prevOutpoint !== undefined) j['prevOutpoint'] = { txidHex: txidHexOf(p.prevOutpoint.txid), vout: p.prevOutpoint.vout };
  return j;
}

export function bundleToJson(b: ProofBundle): Record<string, unknown> {
  const j: Record<string, unknown> = {
    disclosedFields: b.disclosedFields.map((f) => ({ tag: f.tag, valueHex: toHexLower(f.value) })),
    fieldProofs: b.fieldProofs.map((fp) => ({ leafIndex: fp.leafIndex, path: merkleProofToJson(fp.path) })),
    fieldTreeRootHex: hashHex(b.fieldTreeRoot),
    chainLinkProof: chainLinkProofToJson(b.chainLinkProof),
    inclusion: { txidHex: txidHexOf(b.inclusion.txid), merklePath: merkleProofToJson(b.inclusion.merklePath) },
  };
  if (b.rootAttestation !== undefined) j['rootAttestationHex'] = toHexLower(b.rootAttestation);
  if (b.headDigest !== undefined) j['headDigestHex'] = hashHex(b.headDigest);
  return j;
}

function obj(x: unknown): Record<string, unknown> | undefined {
  return typeof x === 'object' && x !== null && !Array.isArray(x) ? (x as Record<string, unknown>) : undefined;
}

function merkleProofFrom(x: unknown): MerkleProof | undefined {
  const o = obj(x);
  if (o === undefined || typeof o['index'] !== 'number' || !Array.isArray(o['siblingsHex'])) return undefined;
  const siblings: Hash[] = [];
  for (const s of o['siblingsHex']) {
    const h = hashFrom(s);
    if (h === undefined) return undefined;
    siblings.push(h);
  }
  return { index: o['index'], siblings };
}

export function bundleFromJson(x: unknown): Result<ProofBundle, string> {
  const o = obj(x);
  if (o === undefined) return err('bundle must be an object');
  if (!Array.isArray(o['disclosedFields']) || !Array.isArray(o['fieldProofs'])) return err('bad disclosedFields/fieldProofs');
  const disclosedFields = [];
  for (const f of o['disclosedFields']) {
    const fo = obj(f);
    const value = bytesFrom(fo?.['valueHex']);
    if (fo === undefined || typeof fo['tag'] !== 'string' || value === undefined) return err('bad disclosed field');
    disclosedFields.push({ tag: fo['tag'], value });
  }
  const fieldProofs = [];
  for (const fp of o['fieldProofs']) {
    const fo = obj(fp);
    const path = merkleProofFrom(fo?.['path']);
    if (fo === undefined || typeof fo['leafIndex'] !== 'number' || path === undefined) return err('bad field proof');
    fieldProofs.push({ leafIndex: fo['leafIndex'], path });
  }
  const fieldTreeRoot = hashFrom(o['fieldTreeRootHex']);
  if (fieldTreeRoot === undefined) return err('bad fieldTreeRootHex');

  const cp = obj(o['chainLinkProof']);
  if (cp === undefined) return err('bad chainLinkProof');
  const clTxid = txidFrom(cp['txidHex']);
  const clRoot = hashFrom(cp['fieldRootHex']);
  const clPub = pointFrom(cp['linkPubHex']);
  const clSig = bytesFrom(cp['signatureHex']);
  if (typeof cp['index'] !== 'number' || clTxid === undefined || clRoot === undefined || clPub === undefined || clSig === undefined) return err('bad chainLinkProof fields');
  const chainLinkProof: ChainLinkProof = { index: cp['index'], txid: clTxid, fieldRoot: clRoot, linkPub: clPub, signature: clSig };
  if (cp['prevTxidHex'] !== undefined) {
    const pt = txidFrom(cp['prevTxidHex']);
    const pr = hashFrom(cp['prevFieldRootHex']);
    const pp = pointFrom(cp['prevLinkPubHex']);
    const po = obj(cp['prevOutpoint']);
    const pot = txidFrom(po?.['txidHex']);
    if (pt === undefined || pr === undefined || pp === undefined || po === undefined || pot === undefined || typeof po['vout'] !== 'number') return err('bad predecessor data');
    chainLinkProof.prevTxid = pt;
    chainLinkProof.prevFieldRoot = pr;
    chainLinkProof.prevLinkPub = pp;
    const outpoint: Outpoint = { txid: pot, vout: po['vout'] };
    chainLinkProof.prevOutpoint = outpoint;
  }

  const inc = obj(o['inclusion']);
  const incTxid = txidFrom(inc?.['txidHex']);
  const incPath = merkleProofFrom(inc?.['merklePath']);
  if (inc === undefined || incTxid === undefined || incPath === undefined) return err('bad inclusion');

  const bundle: ProofBundle = { disclosedFields, fieldProofs, fieldTreeRoot, chainLinkProof, inclusion: { txid: incTxid, merklePath: incPath } };
  const att = bytesFrom(o['rootAttestationHex']);
  if (att !== undefined) bundle.rootAttestation = att;
  const hd = hashFrom(o['headDigestHex']);
  if (hd !== undefined) bundle.headDigest = hd;
  return ok(bundle);
}
