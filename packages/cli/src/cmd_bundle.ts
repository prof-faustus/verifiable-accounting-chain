// bundle-issue --scenario <file.json> --fields tag,tag : issue a tiny bundle.
// bundle-verify --bundle <file.json>                   : verify a bundle.
import { parseArgs } from 'node:util';
import { HashOps, TxidOps, doubleSha256, pointToHex, pointFromHex, toHexLower, fromHex, HeaderChain, parseHeader, serializeHeader, meetsTarget } from '@vaa/bsv';
import type { Hash, BlockHeader } from '@vaa/bsv';
import type { AccountingField, AccountingTransaction } from '@vaa/evidence';
import { fieldTreeRoot } from '@vaa/evidence';
import { issueBundle, verifyBundle } from '@vaa/bundle';
import { ChainService, bundleToJson, bundleFromJson } from '@vaa/api';
import { readJsonFile, printErr, printJson, must } from './args.js';
import { badArgs, failure } from './errors.js';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function syntheticHeaderFor(root: Hash): BlockHeader {
  let header: BlockHeader = { version: 1, prevBlockHash: HashOps.zero(), merkleRoot: root, time: 0, bits: 0x2100ffff, nonce: 0 };
  while (!meetsTarget(header)) header = { ...header, nonce: header.nonce + 1 };
  return header;
}

function parseTx(x: unknown): AccountingTransaction | undefined {
  if (typeof x !== 'object' || x === null) return undefined;
  const o = x as Record<string, unknown>;
  if (typeof o['kind'] !== 'string' || !Array.isArray(o['fields'])) return undefined;
  const fields: AccountingField[] = [];
  for (const f of o['fields']) {
    const fo = f as Record<string, unknown>;
    const v = typeof fo['valueHex'] === 'string' ? fromHex(fo['valueHex']) : undefined;
    if (typeof fo['tag'] !== 'string' || v === undefined || !v.ok) return undefined;
    fields.push({ tag: fo['tag'], value: v.value });
  }
  return { kind: o['kind'] as AccountingTransaction['kind'], fields };
}

export function runBundleIssue(argv: string[]): number {
  let file: string | undefined;
  let fieldsArg: string | undefined;
  try {
    const v = parseArgs({ args: argv, options: { scenario: { type: 'string' }, fields: { type: 'string' } } }).values;
    file = v.scenario;
    fieldsArg = v.fields;
  } catch {
    printErr(badArgs('usage: vaa bundle-issue --scenario <file.json> --fields tag,tag'));
    return 2;
  }
  if (file === undefined || fieldsArg === undefined) {
    printErr(badArgs('--scenario <file.json> and --fields tag,tag are required'));
    return 2;
  }
  const data = readJsonFile(file);
  if (!data.ok) {
    printErr(data.error);
    return 2;
  }
  const o = data.value as Record<string, unknown>;
  const tx = parseTx(o['accountingTx']);
  if (typeof o['seed'] !== 'string' || typeof o['entity'] !== 'string' || typeof o['period'] !== 'string' || tx === undefined) {
    printErr(failure('file must contain seed, entity, period, and accountingTx'));
    return 1;
  }
  const wantedTags = fieldsArg.split(',').map((t) => t.trim()).filter((t) => t.length > 0);
  const indices: number[] = [];
  for (const tag of wantedTags) {
    const idx = tx.fields.findIndex((f) => f.tag === tag);
    if (idx < 0) {
      printErr(failure(`field tag not found: ${tag}`));
      return 1;
    }
    indices.push(idx);
  }
  const root = fieldTreeRoot(tx);
  if (!root.ok) {
    printErr(failure('field tree root failed'));
    return 1;
  }
  const svc = new ChainService(enc(o['seed']), enc(o['entity']), enc(o['period']));
  const txid0 = must(TxidOps.fromInternalBytes(new Uint8Array(32).fill(1)));
  svc.append(txid0, doubleSha256(enc('genesis')), undefined);
  const ourTxid = must(TxidOps.fromInternalBytes(new Uint8Array(32).fill(2)));
  svc.append(ourTxid, root.value, 0);

  const blockRoot = must(HashOps.fromInternalBytes(TxidOps.toInternalBytes(ourTxid)));
  const header = syntheticHeaderFor(blockRoot);

  const bundle = issueBundle(tx, indices, svc.getChain(), 1, { inclusion: { txid: ourTxid, merklePath: { index: 0, siblings: [] } } });
  if (!bundle.ok) {
    printErr(failure(`issue failed: ${bundle.error.kind}`));
    return 1;
  }
  printJson({
    bundle: bundleToJson(bundle.value),
    rootPubHex: pointToHex(svc.rootPubPoint()),
    genesisMsgHex: HashOps.toDisplayHex(svc.genesis()),
    headers: [toHexLower(serializeHeader(header))],
  });
  return 0;
}

export function runBundleVerify(argv: string[]): number {
  let file: string | undefined;
  try {
    file = parseArgs({ args: argv, options: { bundle: { type: 'string' } } }).values.bundle;
  } catch {
    printErr(badArgs('usage: vaa bundle-verify --bundle <file.json>'));
    return 2;
  }
  if (file === undefined) {
    printErr(badArgs('--bundle <file.json> is required'));
    return 2;
  }
  const data = readJsonFile(file);
  if (!data.ok) {
    printErr(data.error);
    return 2;
  }
  const o = data.value as Record<string, unknown>;
  const rootPub = typeof o['rootPubHex'] === 'string' ? pointFromHex(o['rootPubHex']) : undefined;
  const genesisMsg = typeof o['genesisMsgHex'] === 'string' ? HashOps.fromDisplayHex(o['genesisMsgHex']) : undefined;
  if (rootPub === undefined || !rootPub.ok || genesisMsg === undefined || !genesisMsg.ok || !Array.isArray(o['headers'])) {
    printErr(failure('file must contain rootPubHex, genesisMsgHex, headers[]'));
    return 1;
  }
  const headerChain = new HeaderChain();
  for (const hHex of o['headers']) {
    const bytes = typeof hHex === 'string' ? fromHex(hHex) : undefined;
    if (bytes === undefined || !bytes.ok) {
      printErr(failure('invalid header hex'));
      return 1;
    }
    const header = parseHeader(bytes.value);
    if (!header.ok) {
      printErr(failure('invalid header'));
      return 1;
    }
    if (!headerChain.add(header.value).ok) {
      printErr(failure('header did not validate'));
      return 1;
    }
  }
  const decoded = bundleFromJson(o['bundle']);
  if (!decoded.ok) {
    printErr(failure(`bad bundle: ${decoded.error}`));
    return 1;
  }
  const result = verifyBundle(rootPub.value, genesisMsg.value, headerChain, decoded.value);
  printJson(result.ok ? { ok: true } : { ok: false, reason: result.reason });
  return result.ok ? 0 : 1;
}
