// A deterministic chain/bundle vector for `reproduce`. Every value here is a pure
// function of fixed inputs (no randomness, no signatures stored): the chain head
// and per-link public keys are EC derivations, and the disclosed-field Merkle
// path is a hash fold. `reproduce` regenerates this and diffs it.
import { HashOps, TxidOps, doubleSha256, pointToHex } from '@vaa/bsv';
import type { Txid, Hash } from '@vaa/bsv';
import { numericValue, fieldTreeRoot, discloseField } from '@vaa/evidence';
import type { AccountingTransaction } from '@vaa/evidence';
import { rootFromSeed, sign as keysSign } from '@vaa/keys';
import { TransactionChain, genesisMessage, deriveHeadPriv, deriveNextPriv, linkMessage } from '@vaa/chain';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function txidAt(i: number): Txid {
  const t = new Uint8Array(32);
  t[0] = i & 0xff;
  t[2] = 0x1c;
  const r = TxidOps.fromInternalBytes(t);
  if (!r.ok) throw new Error('txid');
  return r.value;
}

function bigInvoice(fieldCount: number): AccountingTransaction {
  const fields = [];
  for (let i = 0; i < fieldCount; i++) fields.push({ tag: `line[${i}].net`, value: numericValue(BigInt(1000 + i)) });
  return { kind: 'invoice', fields };
}

export const CHAIN_VECTOR_SEED = 'chain-vector';

export function buildChainVector(): Record<string, unknown> {
  const entity = 'entity';
  const period = 'period';
  const { rootPriv, rootPub } = rootFromSeed(enc(CHAIN_VECTOR_SEED));
  const genesisMsg = genesisMessage(enc(entity), enc(period));
  const chain = new TransactionChain(rootPub, genesisMsg);

  const N = 5;
  const txids: Txid[] = [];
  const roots: Hash[] = [];
  const privs: bigint[] = [];
  for (let i = 0; i < N; i++) {
    const txid = txidAt(i);
    const root = doubleSha256(enc('cr' + i));
    const priv = i === 0 ? deriveHeadPriv(rootPriv, genesisMsg) : deriveNextPriv(privs[i - 1]!, linkMessage(txids[i - 1]!, roots[i - 1]!, root));
    privs.push(priv);
    const prevOutpoint = i === 0 ? undefined : { txid: txids[i - 1]!, vout: 0 };
    chain.append(txid, root, prevOutpoint, (_idx, m) => keysSign(priv, m));
    txids.push(txid);
    roots.push(root);
  }

  // bundle determinism: the field-tree root and a disclosed field's Merkle path.
  const invoice = bigInvoice(64);
  const ftr = fieldTreeRoot(invoice);
  if (!ftr.ok) throw new Error('field tree');
  const disclosed = discloseField(invoice, 1);
  if (!disclosed.ok) throw new Error('disclose');

  return {
    seed: CHAIN_VECTOR_SEED,
    entity,
    period,
    genesisMsgHex: HashOps.toDisplayHex(genesisMsg),
    headPubHex: pointToHex(chain.head()),
    linkPubsHex: chain.links().map((l) => pointToHex(l.linkPub)),
    chainVerifies: chain.verifyChain().ok,
    invoiceFieldCount: 64,
    discloseIndex: 1,
    bundleFieldTreeRootHex: HashOps.toDisplayHex(ftr.value),
    bundleFieldLeafIndex: disclosed.value.leafIndex,
    bundleFieldPathHex: disclosed.value.proof.siblings.map((h) => HashOps.toDisplayHex(h)),
  };
}
