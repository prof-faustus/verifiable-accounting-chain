// Auditor PROOF BUNDLE size measurement (Part 5.1 addition): confirm the bundle
// is small and INDEPENDENT of the transaction's total field count — the disclosed
// field plus a log-sized Merkle path and the fixed chain-link/inclusion evidence,
// not O(fields).
import { HashOps, TxidOps, doubleSha256, HeaderChain, meetsTarget } from '@vaa/bsv';
import type { Hash, BlockHeader } from '@vaa/bsv';
import { numericValue, fieldTreeRoot } from '@vaa/evidence';
import type { AccountingTransaction } from '@vaa/evidence';
import { rootFromSeed, sign as keysSign } from '@vaa/keys';
import { TransactionChain, genesisMessage, deriveHeadPriv, deriveNextPriv, linkMessage } from '@vaa/chain';
import { issueBundle, verifyBundle } from '@vaa/bundle';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function bigInvoice(fieldCount: number): AccountingTransaction {
  const fields = [];
  for (let i = 0; i < fieldCount; i++) fields.push({ tag: `line[${i}].net`, value: numericValue(BigInt(1000 + i)) });
  return { kind: 'invoice', fields };
}

function syntheticHeaderFor(root: Hash): BlockHeader {
  let header: BlockHeader = { version: 1, prevBlockHash: HashOps.zero(), merkleRoot: root, time: 0, bits: 0x2100ffff, nonce: 0 };
  while (!meetsTarget(header)) header = { ...header, nonce: header.nonce + 1 };
  return header;
}

export interface BundleSizePoint {
  fieldCount: number;
  pathSiblings: number;
  disclosedFields: number;
  verifies: boolean;
}

// Build a real anchored, chained bundle for one field and measure its shape.
export function measureBundlePoint(fieldCount: number): BundleSizePoint {
  const tx = bigInvoice(fieldCount);
  const root = fieldTreeRoot(tx);
  if (!root.ok) throw new Error('field tree root failed');

  const { rootPriv, rootPub } = rootFromSeed(enc('bundle-size'));
  const genesisMsg = genesisMessage(enc('e'), enc('p'));
  const chain = new TransactionChain(rootPub, genesisMsg);
  const t0 = TxidOps.fromInternalBytes(new Uint8Array(32).fill(1));
  const our = TxidOps.fromInternalBytes(new Uint8Array(32).fill(2));
  if (!t0.ok || !our.ok) throw new Error('txid');
  const priv0 = deriveHeadPriv(rootPriv, genesisMsg);
  chain.append(t0.value, doubleSha256(enc('g')), undefined, (_i, m) => keysSign(priv0, m));
  const priv1 = deriveNextPriv(priv0, linkMessage(t0.value, doubleSha256(enc('g')), root.value));
  chain.append(our.value, root.value, { txid: t0.value, vout: 0 }, (_i, m) => keysSign(priv1, m));

  const blockRoot = HashOps.fromInternalBytes(TxidOps.toInternalBytes(our.value));
  if (!blockRoot.ok) throw new Error('block root');
  const headerChain = new HeaderChain();
  headerChain.add(syntheticHeaderFor(blockRoot.value));

  const bundle = issueBundle(tx, [1], chain, 1, { inclusion: { txid: our.value, merklePath: { index: 0, siblings: [] } } });
  if (!bundle.ok) throw new Error('issue failed');
  const verifies = verifyBundle(rootPub, genesisMsg, headerChain, bundle.value).ok;
  return {
    fieldCount,
    pathSiblings: bundle.value.fieldProofs[0]?.path.siblings.length ?? -1,
    disclosedFields: bundle.value.disclosedFields.length,
    verifies,
  };
}

export const BUNDLE_SIZE_POINTS = [256, 4096];

export function measureBundleSizes(): BundleSizePoint[] {
  return BUNDLE_SIZE_POINTS.map((n) => measureBundlePoint(n));
}
