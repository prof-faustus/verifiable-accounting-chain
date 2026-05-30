import { HashOps, TxidOps, doubleSha256, HeaderChain, meetsTarget } from '@vaa/bsv';
import { numericValue, stringValue, fieldTreeRoot } from '@vaa/evidence';
import { rootFromSeed, sign as keysSign } from '@vaa/keys';
import { TransactionChain, genesisMessage, deriveHeadPriv, deriveNextPriv, linkMessage } from '@vaa/chain';

const enc = (s) => new TextEncoder().encode(s);
export const ACCOUNT_PATH = ['GL', '2200-VAT'];

export function taxStructure() {
  return {
    version: 1,
    root: {
      path: [],
      label: 'ACME',
      children: [
        {
          path: ['GL'],
          label: 'GL',
          children: [
            { path: ['GL', '2200-VAT'], label: 'VAT', accountType: 'liability', children: [], fieldTags: ['tax.code', 'tax.rate', 'tax.outputAmount', 'tax.inputAmount', 'tax.vatPayable'] },
          ],
        },
      ],
    },
  };
}

export function taxMap() {
  const { rootPriv, rootPub } = rootFromSeed(enc('tax-entity'));
  return { map: { structure: taxStructure(), rootPub }, rootPriv, rootPub };
}

export function vatReturnTx(output, input) {
  return {
    kind: 'journal',
    fields: [
      { tag: 'customer.name', value: stringValue('ACME Ltd') },
      { tag: 'tax.outputAmount', value: numericValue(output) },
      { tag: 'tax.inputAmount', value: numericValue(input) },
      { tag: 'tax.vatPayable', value: numericValue(output - input) },
    ],
  };
}

function txidAt(i) {
  const t = new Uint8Array(32);
  t[0] = i & 0xff;
  t[2] = 0x42;
  return TxidOps.fromInternalBytes(t).value;
}

function syntheticHeaderFor(root) {
  let header = { version: 1, prevBlockHash: HashOps.zero(), merkleRoot: root, time: 0, bits: 0x2100ffff, nonce: 0 };
  while (!meetsTarget(header)) header = { ...header, nonce: header.nonce + 1 };
  return header;
}

export function buildTaxScenario(output, input) {
  const { map, rootPriv, rootPub } = taxMap();
  const taxTx = vatReturnTx(output, input);
  const root = fieldTreeRoot(taxTx).value;
  const genesisMsg = genesisMessage(enc('entity'), enc('period'));
  const chain = new TransactionChain(rootPub, genesisMsg);

  const txid0 = txidAt(0);
  const root0 = doubleSha256(enc('g'));
  const priv0 = deriveHeadPriv(rootPriv, genesisMsg);
  chain.append(txid0, root0, undefined, (_i, m) => keysSign(priv0, m));

  const ourTxid = txidAt(1);
  const priv1 = deriveNextPriv(priv0, linkMessage(txid0, root0, root));
  chain.append(ourTxid, root, { txid: txid0, vout: 0 }, (_i, m) => keysSign(priv1, m));

  const blockRoot = HashOps.fromInternalBytes(TxidOps.toInternalBytes(ourTxid)).value;
  const headerChain = new HeaderChain();
  headerChain.add(syntheticHeaderFor(blockRoot));
  const inclusion = { txid: ourTxid, merklePath: { index: 0, siblings: [] } };

  const declared = { outputTax: output, inputTax: input, payable: output - input };
  return { map, accountPath: ACCOUNT_PATH, taxTx, chain, chainIndex: 1, rootPub, genesisMsg, headerChain, inclusion, declared };
}
