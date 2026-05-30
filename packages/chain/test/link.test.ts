import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pointMulG, pointEq, doubleSha256, TxidOps } from '@vaa/bsv';
import { rootFromSeed } from '@vaa/keys';
import { linkMessage, deriveHeadPub, deriveHeadPriv, deriveNextPub, deriveNextPriv, genesisMessage } from '@vaa/chain';

const enc = (s: string) => new TextEncoder().encode(s);
const txid = (s: string) => {
  const b = new Uint8Array(32);
  b.set(enc(s).slice(0, 8));
  return TxidOps.fromInternalBytes(b).value;
};

test('C3-T1 deriveNextPub == deriveNextPriv·G', () => {
  const prevPriv = deriveHeadPriv(rootFromSeed(enc('s')).rootPriv, genesisMessage(enc('e'), enc('p')));
  const prevPub = pointMulG(prevPriv);
  const m = linkMessage(txid('tx-prev'), doubleSha256(enc('rprev')), doubleSha256(enc('r')));
  assert.equal(pointEq(deriveNextPub(prevPub, m), pointMulG(deriveNextPriv(prevPriv, m))), true);
});

test('C3-T2 changing prevTxid / prevRoot / root changes the next linkPub', () => {
  const prevPub = pointMulG(7n);
  const base = deriveNextPub(prevPub, linkMessage(txid('a'), doubleSha256(enc('rp')), doubleSha256(enc('r'))));
  const diffTxid = deriveNextPub(prevPub, linkMessage(txid('b'), doubleSha256(enc('rp')), doubleSha256(enc('r'))));
  const diffPrevRoot = deriveNextPub(prevPub, linkMessage(txid('a'), doubleSha256(enc('rp2')), doubleSha256(enc('r'))));
  const diffRoot = deriveNextPub(prevPub, linkMessage(txid('a'), doubleSha256(enc('rp')), doubleSha256(enc('r2'))));
  assert.equal(pointEq(base, diffTxid), false);
  assert.equal(pointEq(base, diffPrevRoot), false);
  assert.equal(pointEq(base, diffRoot), false);
});

test('C3-T3 the head linkPub is bound to the root', () => {
  const g = genesisMessage(enc('e'), enc('p'));
  const head1 = deriveHeadPub(rootFromSeed(enc('root-1')).rootPub, g);
  const head2 = deriveHeadPub(rootFromSeed(enc('root-2')).rootPub, g);
  assert.equal(pointEq(head1, head2), false);
});
