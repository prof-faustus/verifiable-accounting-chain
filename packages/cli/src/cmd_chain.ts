// chain-append --in <file.json>  : append the listed links and print the chain.
// chain-verify --in <file.json>  : verify a serialised chain.
import { parseArgs } from 'node:util';
import { HashOps, TxidOps, pointToHex, pointFromHex, toHexLower, fromHex } from '@vaa/bsv';
import type { Point } from '@vaa/bsv';
import { verifyLinks } from '@vaa/chain';
import type { Link, Outpoint } from '@vaa/chain';
import { ChainService } from '@vaa/api';
import { readJsonFile, printErr, printJson, must } from './args.js';
import { badArgs, failure } from './errors.js';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function linkToJson(l: Link): Record<string, unknown> {
  const j: Record<string, unknown> = {
    index: l.index,
    txidHex: TxidOps.toDisplayHex(l.txid),
    fieldRootHex: HashOps.toDisplayHex(l.fieldRoot),
    linkPubHex: pointToHex(l.linkPub),
    signatureHex: toHexLower(l.signature),
  };
  if (l.prevOutpoint !== undefined) j['prevOutpoint'] = { txidHex: TxidOps.toDisplayHex(l.prevOutpoint.txid), vout: l.prevOutpoint.vout };
  return j;
}

function linkFromJson(x: unknown): Link | undefined {
  if (typeof x !== 'object' || x === null) return undefined;
  const o = x as Record<string, unknown>;
  const txid = typeof o['txidHex'] === 'string' ? TxidOps.fromDisplayHex(o['txidHex']) : undefined;
  const fieldRoot = typeof o['fieldRootHex'] === 'string' ? HashOps.fromDisplayHex(o['fieldRootHex']) : undefined;
  const linkPub = typeof o['linkPubHex'] === 'string' ? pointFromHex(o['linkPubHex']) : undefined;
  const signature = typeof o['signatureHex'] === 'string' ? fromHex(o['signatureHex']) : undefined;
  if (typeof o['index'] !== 'number' || txid === undefined || !txid.ok || fieldRoot === undefined || !fieldRoot.ok || linkPub === undefined || !linkPub.ok || signature === undefined || !signature.ok) return undefined;
  const link: Link = { index: o['index'], txid: txid.value, fieldRoot: fieldRoot.value, linkPub: linkPub.value, signature: signature.value };
  const po = o['prevOutpoint'];
  if (typeof po === 'object' && po !== null) {
    const p = po as Record<string, unknown>;
    const pt = typeof p['txidHex'] === 'string' ? TxidOps.fromDisplayHex(p['txidHex']) : undefined;
    if (pt !== undefined && pt.ok && typeof p['vout'] === 'number') {
      const outpoint: Outpoint = { txid: pt.value, vout: p['vout'] };
      link.prevOutpoint = outpoint;
    }
  }
  return link;
}

function readInArg(argv: string[], usage: string): { file: string | undefined; bad: boolean } {
  try {
    const v = parseArgs({ args: argv, options: { in: { type: 'string' } } }).values;
    return { file: v.in, bad: false };
  } catch {
    printErr(badArgs(usage));
    return { file: undefined, bad: true };
  }
}

export function runChainAppend(argv: string[]): number {
  const { file, bad } = readInArg(argv, 'usage: vaa chain-append --in <file.json>');
  if (bad) return 2;
  if (file === undefined) {
    printErr(badArgs('--in <file.json> is required'));
    return 2;
  }
  const data = readJsonFile(file);
  if (!data.ok) {
    printErr(data.error);
    return 2;
  }
  const o = data.value as Record<string, unknown>;
  if (typeof o['seed'] !== 'string' || typeof o['entity'] !== 'string' || typeof o['period'] !== 'string' || !Array.isArray(o['links'])) {
    printErr(failure('file must contain seed, entity, period, and links[]'));
    return 1;
  }
  const svc = new ChainService(enc(o['seed']), enc(o['entity']), enc(o['period']));
  for (const item of o['links']) {
    const li = item as Record<string, unknown>;
    const txid = typeof li['txidHex'] === 'string' ? TxidOps.fromDisplayHex(li['txidHex']) : undefined;
    const fieldRoot = typeof li['fieldRootHex'] === 'string' ? HashOps.fromDisplayHex(li['fieldRootHex']) : undefined;
    if (txid === undefined || !txid.ok || fieldRoot === undefined || !fieldRoot.ok) {
      printErr(failure('each link needs txidHex and fieldRootHex'));
      return 1;
    }
    const prevVout = typeof li['prevVout'] === 'number' ? li['prevVout'] : undefined;
    const r = svc.append(txid.value, fieldRoot.value, prevVout);
    if (!r.ok) {
      printErr(failure(`append failed: ${r.error.kind}`));
      return 1;
    }
  }
  const chain = svc.getChain();
  printJson({
    headPubHex: pointToHex(chain.head()),
    rootPubHex: pointToHex(svc.rootPubPoint()),
    genesisMsgHex: HashOps.toDisplayHex(svc.genesis()),
    links: chain.links().map(linkToJson),
    verify: chain.verifyChain().ok,
  });
  return 0;
}

export function runChainVerify(argv: string[]): number {
  const { file, bad } = readInArg(argv, 'usage: vaa chain-verify --in <file.json>');
  if (bad) return 2;
  if (file === undefined) {
    printErr(badArgs('--in <file.json> is required'));
    return 2;
  }
  const data = readJsonFile(file);
  if (!data.ok) {
    printErr(data.error);
    return 2;
  }
  const o = data.value as Record<string, unknown>;
  const headPub: Point | undefined = typeof o['headPubHex'] === 'string' && pointFromHex(o['headPubHex']).ok ? must(pointFromHex(o['headPubHex'])) : undefined;
  if (headPub === undefined || !Array.isArray(o['links'])) {
    printErr(failure('file must contain headPubHex and links[]'));
    return 1;
  }
  const links: Link[] = [];
  for (const item of o['links']) {
    const l = linkFromJson(item);
    if (l === undefined) {
      printErr(failure('invalid link in file'));
      return 1;
    }
    links.push(l);
  }
  const result = verifyLinks(headPub, links);
  printJson(result.ok ? { ok: true } : { ok: false, reason: result.reason });
  return result.ok ? 0 : 1;
}
