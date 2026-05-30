import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HashOps, TxidOps, doubleSha256, pointMulG, pointToHex, containsOpReturn } from '@vaa/bsv';
import type { ChainItem } from '@vaa/evidence';
import {
  encodeStream,
  decodeStream,
  buildAccountingTx,
  parseAccountingTx,
  bigInvoiceTransaction,
} from '@vaa/evidence';
import { rootFromSeed, sign as keysSign } from '@vaa/keys';
import { TransactionChain, genesisMessage, deriveHeadPriv, deriveNextPriv, linkMessage, verifyLinkProof } from '@vaa/chain';

const enc = (s: string) => new TextEncoder().encode(s);
const txidAt = (i: number) => {
  const t = new Uint8Array(32);
  t[0] = i & 0xff;
  t[2] = 0x5a;
  return TxidOps.fromInternalBytes(t).value;
};

function buildSignedChain(n: number) {
  const { rootPriv, rootPub } = rootFromSeed(enc('enc-test'));
  const genesisMsg = genesisMessage(enc('e'), enc('p'));
  const chain = new TransactionChain(rootPub, genesisMsg);
  const txids = [];
  const roots = [];
  const privs = [];
  for (let i = 0; i < n; i++) {
    const txid = txidAt(i);
    const root = doubleSha256(enc('r' + i));
    const priv = i === 0 ? deriveHeadPriv(rootPriv, genesisMsg) : deriveNextPriv(privs[i - 1]!, linkMessage(txids[i - 1]!, roots[i - 1]!, root));
    privs.push(priv);
    const prevOutpoint = i === 0 ? undefined : { txid: txids[i - 1]!, vout: 0 };
    chain.append(txid, root, prevOutpoint, (_idx, m) => keysSign(priv, m));
    txids.push(txid);
    roots.push(root);
  }
  return { chain, rootPub, genesisMsg, txids, roots };
}

function roundTrip(item: ChainItem): ChainItem {
  const decoded = decodeStream(encodeStream([item]));
  assert.equal(decoded.ok, true);
  if (!decoded.ok) throw new Error('decode failed');
  assert.equal(decoded.value.length, 1);
  return decoded.value[0]!;
}

test('P3enc-T1 each item type 0x01..0x08 encodes/decodes intact', () => {
  const root = doubleSha256(enc('root'));
  const txid = txidAt(3);
  const linkPub = pointMulG(12345n);
  const sig = keysSign(7n, enc('m'));

  const header = roundTrip({ type: 'header', kind: 1, fieldCount: 5, fieldTreeRoot: root, rootPartScheme: 0, partCount: 0 });
  assert.equal(header.type === 'header' && header.fieldCount, 5);

  const field = roundTrip({ type: 'field', leafIndex: 4, tag: 'tax.vatPayable', value: enc('123') });
  assert.equal(field.type === 'field' && field.tag, 'tax.vatPayable');

  const rootPart = roundTrip({ type: 'rootPart', partIndex: 0, partTotal: 2, segOffset: 0, segLen: 3, seg: enc('abc') });
  assert.equal(rootPart.type === 'rootPart' && rootPart.partTotal, 2);

  const assist = roundTrip({ type: 'assist', level: 2, labels: [root, doubleSha256(enc('l2'))] });
  assert.equal(assist.type === 'assist' && assist.labels.length, 2);

  const chainLink = roundTrip({ type: 'chainLink', index: 1, prevTxid: txid, prevFieldRoot: root, prevOutpointVout: 0, linkPub, signature: sig });
  assert.equal(chainLink.type === 'chainLink' && pointToHex(chainLink.linkPub), pointToHex(linkPub));

  const mappingRoot = roundTrip({ type: 'mappingRoot', mappingVersion: 7, mappingRoot: root });
  assert.equal(mappingRoot.type === 'mappingRoot' && mappingRoot.mappingVersion, 7);

  const tripleRef = roundTrip({ type: 'tripleRef', side: 'credit', sharedTxid: txid, sharedVout: 2 });
  assert.equal(tripleRef.type === 'tripleRef' && tripleRef.side, 'credit');

  const pkiAttest = roundTrip({ type: 'pkiAttest', headDigest: root, rootSignature: sig });
  assert.equal(pkiAttest.type === 'pkiAttest' && pkiAttest.rootSignature.length, sig.length);
});

test('P3enc-T2 the CHAIN-LINK item bytes equal the bytes used to derive/verify the link', () => {
  const { chain, rootPub, genesisMsg, txids, roots } = buildSignedChain(2);
  const links = chain.links();
  const link1 = links[1]!;
  const item: ChainItem = {
    type: 'chainLink',
    index: 1,
    prevTxid: txids[0]!,
    prevFieldRoot: roots[0]!,
    prevOutpointVout: 0,
    linkPub: link1.linkPub,
    signature: link1.signature,
  };
  const decoded = decodeStream(encodeStream([item]));
  assert.equal(decoded.ok, true);
  if (!decoded.ok) return;
  const d = decoded.value[0]!;
  assert.equal(d.type, 'chainLink');
  if (d.type !== 'chainLink') return;
  // reconstruct the link proof from the on-chain item and verify it
  const proof = {
    index: 1,
    txid: txids[1]!,
    fieldRoot: roots[1]!,
    linkPub: d.linkPub,
    signature: d.signature,
    prevTxid: d.prevTxid,
    prevFieldRoot: d.prevFieldRoot,
    prevOutpoint: { txid: d.prevTxid, vout: d.prevOutpointVout },
    prevLinkPub: links[0]!.linkPub,
  };
  assert.equal(verifyLinkProof(rootPub, genesisMsg, proof).ok, true);
});

test('P3enc-T3 the MAPPING-ROOT item commits the structure version + root', () => {
  const mr = doubleSha256(enc('structure'));
  const item = roundTrip({ type: 'mappingRoot', mappingVersion: 3, mappingRoot: mr });
  assert.equal(item.type === 'mappingRoot' && item.mappingVersion, 3);
  if (item.type === 'mappingRoot') assert.equal(HashOps.toDisplayHex(item.mappingRoot), HashOps.toDisplayHex(mr));
});

test('P3enc-T4 the TRIPLE-REF item recovers the shared outpoint for both sides', () => {
  const shared = txidAt(9);
  for (const side of ['debit', 'credit'] as const) {
    const item = roundTrip({ type: 'tripleRef', side, sharedTxid: shared, sharedVout: 5 });
    assert.equal(item.type === 'tripleRef' && item.side, side);
    if (item.type === 'tripleRef') {
      assert.equal(TxidOps.toDisplayHex(item.sharedTxid), TxidOps.toDisplayHex(shared));
      assert.equal(item.sharedVout, 5);
    }
  }
});

test('P3enc-T5 a 1000-field invoice with mapping root + chain link + triple refs spans multiple outputs and round-trips', () => {
  const tx = bigInvoiceTransaction(1000);
  const { chain, txids, roots } = buildSignedChain(2);
  const link1 = chain.links()[1]!;
  const extras: ChainItem[] = [
    { type: 'mappingRoot', mappingVersion: 1, mappingRoot: doubleSha256(enc('struct')) },
    { type: 'chainLink', index: 1, prevTxid: txids[0]!, prevFieldRoot: roots[0]!, prevOutpointVout: 0, linkPub: link1.linkPub, signature: link1.signature },
    { type: 'tripleRef', side: 'debit', sharedTxid: txids[1]!, sharedVout: 0 },
    { type: 'tripleRef', side: 'credit', sharedTxid: txids[1]!, sharedVout: 0 },
  ];
  const built = buildAccountingTx(tx, extras);
  assert.equal(built.ok, true);
  if (!built.ok) return;
  assert.ok(built.value.lockingScripts.length > 1);
  const parsed = parseAccountingTx(built.value.lockingScripts);
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.value.tx.fields.length, 1000);
    assert.equal(parsed.value.items.some((i) => i.type === 'mappingRoot'), true);
    assert.equal(parsed.value.items.some((i) => i.type === 'chainLink'), true);
    assert.equal(parsed.value.items.filter((i) => i.type === 'tripleRef').length, 2);
  }
});

test('P3enc-T6 no produced script contains the OP_RETURN opcode', () => {
  const tx = bigInvoiceTransaction(200);
  const built = buildAccountingTx(tx);
  assert.equal(built.ok, true);
  if (built.ok) for (const s of built.value.lockingScripts) assert.equal(containsOpReturn(s), false);
});
