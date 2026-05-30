import { HashOps, TxidOps, HeaderChain, meetsTarget } from '@vaa/bsv';
import { numericValue, fieldTreeRoot } from '@vaa/evidence';
import { buildTripleEntry, SHARED_AMOUNT_TAG } from '@vaa/tripleentry';

const enc = (s) => new TextEncoder().encode(s);

export function txidAt(i) {
  const t = new Uint8Array(32);
  t[0] = i & 0xff;
  t[2] = 0x33;
  return TxidOps.fromInternalBytes(t).value;
}

export function ledgerEntry(id, account, debit, credit) {
  return { type: 'ledgerEntry', id, account, debit, credit };
}

function syntheticHeaderFor(root) {
  let header = { version: 1, prevBlockHash: HashOps.zero(), merkleRoot: root, time: 0, bits: 0x2100ffff, nonce: 0 };
  while (!meetsTarget(header)) header = { ...header, nonce: header.nonce + 1 };
  return header;
}

// Build a triple entry whose postings sum to `postingTotal` and whose shared
// committed amount is `sharedAmount` (equal for a genuine entry).
export function buildTriple(postingTotal, sharedAmount, sharedTxidIndex = 5) {
  const sharedTx = { kind: 'journal', fields: [{ tag: SHARED_AMOUNT_TAG, value: numericValue(sharedAmount) }, { tag: 'event.ref', value: enc('ref-1') }] };
  const sharedFieldTreeRoot = fieldTreeRoot(sharedTx).value;
  const sharedTxid = txidAt(sharedTxidIndex);
  const event = {
    debitParty: 'Buyer',
    creditParty: 'Seller',
    debitPostings: [ledgerEntry('d1', '1000', postingTotal, 0n)],
    creditPostings: [ledgerEntry('c1', '4000', 0n, postingTotal)],
    sharedTx,
    sharedFieldTreeRoot,
    sharedTxid,
    sharedVout: 0,
  };
  const te = buildTripleEntry(event);
  const headerChain = new HeaderChain();
  headerChain.add(syntheticHeaderFor(sharedFieldTreeRoot));
  return { te, headerChain, sharedTxid, sharedFieldTreeRoot };
}
