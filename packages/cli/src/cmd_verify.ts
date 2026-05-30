// verify --bundle <file.json> -> VerifyResult, terminating in the header chain.
// Refuses any trusted-operational request.
import { parseArgs } from 'node:util';
import { HashOps, HeaderChain } from '@vaa/bsv';
import type { Hash, BlockHeader } from '@vaa/bsv';
import { proveAgainstChain } from '@vaa/merkle';
import { readJsonFile, printErr, printJson } from './args.js';
import { badArgs, failure } from './errors.js';

function hashFrom(hex: unknown): Hash | undefined {
  if (typeof hex !== 'string') return undefined;
  const h = HashOps.fromDisplayHex(hex);
  return h.ok ? h.value : undefined;
}

function headerFrom(j: unknown): BlockHeader | undefined {
  if (typeof j !== 'object' || j === null) return undefined;
  const o = j as Record<string, unknown>;
  const prev = hashFrom(o['prevBlockHashHex']);
  const root = hashFrom(o['merkleRootHex']);
  if (prev === undefined || root === undefined) return undefined;
  if (typeof o['version'] !== 'number' || typeof o['time'] !== 'number' || typeof o['bits'] !== 'number' || typeof o['nonce'] !== 'number') return undefined;
  return { version: o['version'], prevBlockHash: prev, merkleRoot: root, time: o['time'], bits: o['bits'], nonce: o['nonce'] };
}

export function runVerify(argv: string[]): number {
  let file: string | undefined;
  try {
    file = parseArgs({ args: argv, options: { bundle: { type: 'string' } } }).values.bundle;
  } catch {
    printErr(badArgs('usage: vaa verify --bundle <file.json>'));
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
  const b = data.value as Record<string, unknown>;

  if (b['mode'] === 'trustedOperational') {
    // The audit path refuses the trusted-operational mode.
    printJson({ ok: false, reason: { kind: 'TrustedOperationalNotAcceptedForAudit' } });
    return 1;
  }

  const leaf = hashFrom(b['leafHex']);
  const root = hashFrom(b['rootHex']);
  const proofObj = b['proof'] as Record<string, unknown> | undefined;
  if (leaf === undefined || root === undefined || proofObj === undefined) {
    printErr(failure('bundle must contain leafHex, rootHex, and proof'));
    return 1;
  }
  const sibsRaw = proofObj['siblingsHex'];
  if (typeof proofObj['index'] !== 'number' || !Array.isArray(sibsRaw)) {
    printErr(failure('bundle.proof must contain index and siblingsHex'));
    return 1;
  }
  const siblings: Hash[] = [];
  for (const s of sibsRaw) {
    const h = hashFrom(s);
    if (h === undefined) {
      printErr(failure('invalid sibling hex'));
      return 1;
    }
    siblings.push(h);
  }

  const chain = new HeaderChain();
  const headers = Array.isArray(b['headers']) ? (b['headers'] as unknown[]) : [];
  for (const hj of headers) {
    const header = headerFrom(hj);
    if (header === undefined) {
      printErr(failure('invalid header in bundle'));
      return 1;
    }
    const added = chain.add(header);
    if (!added.ok) {
      printErr(failure(`header did not validate: ${added.error.kind}`));
      return 1;
    }
  }

  const result = proveAgainstChain(leaf, { index: proofObj['index'], siblings }, root, chain);
  printJson(result.ok ? { ok: true } : { ok: false, reason: result.reason });
  return result.ok ? 0 : 1;
}
