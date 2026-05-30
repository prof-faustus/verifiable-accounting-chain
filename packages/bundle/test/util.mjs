// Build a full end-to-end scenario: an invoice transaction that is a link in a
// PKI-rooted chain and anchored (via a synthetic single-tx block header) in a
// header chain. The synthetic header is a test double for the anchor interface
// (easy target so its hash meets target without mining); it is not presented as
// genuine block data.
import { HashOps, TxidOps, doubleSha256, HeaderChain, meetsTarget } from '@vaa/bsv';
import { numericValue, stringValue, fieldTreeRoot } from '@vaa/evidence';
import { rootFromSeed, sign as keysSign } from '@vaa/keys';
import { TransactionChain, genesisMessage, deriveHeadPriv, deriveNextPriv, linkMessage } from '@vaa/chain';
import { issueBundle } from '@vaa/bundle';

const enc = (s) => new TextEncoder().encode(s);

export function txidAt(i) {
  const t = new Uint8Array(32);
  t[0] = i & 0xff;
  t[1] = (i >> 8) & 0xff;
  t[2] = 0x7e;
  return TxidOps.fromInternalBytes(t).value;
}

export function invoiceWithVat(fieldCount, vatIndex) {
  const fields = [];
  for (let i = 0; i < fieldCount; i++) {
    if (i === vatIndex) fields.push({ tag: 'tax.vatPayable', value: numericValue(120n) });
    else if (i === 0) fields.push({ tag: 'invoice.number', value: stringValue('INV-' + fieldCount) });
    else fields.push({ tag: `line[${i}].net`, value: numericValue(BigInt(1000 + i)) });
  }
  return { kind: 'invoice', fields };
}

function syntheticHeaderFor(root) {
  let header = { version: 1, prevBlockHash: HashOps.zero(), merkleRoot: root, time: 0, bits: 0x2100ffff, nonce: 0 };
  while (!meetsTarget(header)) header = { ...header, nonce: header.nonce + 1 };
  return header;
}

export function buildScenario(fieldCount, vatIndex) {
  const tx = invoiceWithVat(fieldCount, vatIndex);
  const root = fieldTreeRoot(tx).value;

  const { rootPriv, rootPub } = rootFromSeed(enc('bundle-entity'));
  const genesisMsg = genesisMessage(enc('entity'), enc('period'));
  const chain = new TransactionChain(rootPub, genesisMsg);

  // link 0: a genesis accounting tx; link 1: our invoice tx.
  const txid0 = txidAt(0);
  const root0 = doubleSha256(enc('genesis-root'));
  const priv0 = deriveHeadPriv(rootPriv, genesisMsg);
  chain.append(txid0, root0, undefined, (_i, m) => keysSign(priv0, m));

  const ourTxid = txidAt(1);
  const priv1 = deriveNextPriv(priv0, linkMessage(txid0, root0, root));
  chain.append(ourTxid, root, { txid: txid0, vout: 0 }, (_i, m) => keysSign(priv1, m));
  const chainIndex = 1;

  // anchor: a single-tx block whose merkle root is our txid.
  const blockRoot = HashOps.fromInternalBytes(TxidOps.toInternalBytes(ourTxid)).value;
  const headerChain = new HeaderChain();
  headerChain.add(syntheticHeaderFor(blockRoot));
  const inclusion = { txid: ourTxid, merklePath: { index: 0, siblings: [] } };

  return { tx, vatIndex, chain, chainIndex, rootPub, genesisMsg, headerChain, inclusion };
}

export function issueVatBundle(s) {
  return issueBundle(s.tx, [s.vatIndex], s.chain, s.chainIndex, { inclusion: s.inclusion });
}
