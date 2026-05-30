import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HashOps } from '@vaa/bsv';
import { verifyLinks, verifyLinkProof } from '@vaa/chain';
import type { Link } from '@vaa/chain';
import { buildSignedChain, txidAt } from './util.mjs';

test('C4-T1 a chain of N signed, spend-linked transactions verifies', () => {
  const { chain } = buildSignedChain('chain-a', 8);
  assert.equal(chain.verifyChain().ok, true);
});

test('C4-T2 reorder / insert / drop / broken-spend / bad-signature all fail', () => {
  const { chain } = buildSignedChain('chain-b', 6);
  const head = chain.head();
  const links = [...chain.links()] as Link[];
  assert.equal(verifyLinks(head, links).ok, true);

  // reorder links 2 and 3
  const reordered = links.slice();
  [reordered[2], reordered[3]] = [reordered[3]!, reordered[2]!];
  assert.equal(verifyLinks(head, reordered).ok, false);

  // drop link 3
  const dropped = links.slice(0, 3).concat(links.slice(4));
  assert.equal(verifyLinks(head, dropped).ok, false);

  // insert a duplicate of link 2
  const inserted = links.slice(0, 3).concat([links[2]!], links.slice(3));
  assert.equal(verifyLinks(head, inserted).ok, false);

  // broken spend-link: point link 3's outpoint at the wrong tx
  const badSpend = links.map((l) => ({ ...l }));
  badSpend[3] = { ...links[3]!, prevOutpoint: { txid: txidAt(99), vout: 0 } };
  const rs = verifyLinks(head, badSpend);
  assert.equal(rs.ok, false);
  if (!rs.ok) assert.equal(rs.reason.kind, 'SpendLinkBroken');

  // bad signature on link 4
  const badSig = links.map((l) => ({ ...l }));
  const sig = Uint8Array.from(links[4]!.signature);
  sig[sig.length - 1] ^= 0xff;
  badSig[4] = { ...links[4]!, signature: sig };
  const rsig = verifyLinks(head, badSig);
  assert.equal(rsig.ok, false);
  if (!rsig.ok) assert.equal(rsig.reason.kind, 'BadLinkSignature');
});

test('C4-T3 linkProof for a middle link verifies and carries no predecessor field value', () => {
  const { chain, rootPub, genesisMsg } = buildSignedChain('chain-c', 6);
  const proof = chain.linkProof(3);
  assert.equal(proof.ok, true);
  if (proof.ok) {
    assert.equal(verifyLinkProof(rootPub, genesisMsg, proof.value).ok, true);
    // only the predecessor's txid and committed ROOT and outpoint are present
    const keys = Object.keys(proof.value);
    assert.equal(keys.includes('prevFieldValues'), false);
    assert.ok(proof.value.prevFieldRoot !== undefined);
  }
});

test('C4-T4 a tampered fieldRoot / outpoint / signature -> BadChainProof', () => {
  const { chain, rootPub, genesisMsg } = buildSignedChain('chain-d', 6);
  const proof = chain.linkProof(3);
  assert.equal(proof.ok, true);
  if (!proof.ok) return;
  const tamperedRootBytes = HashOps.toInternalBytes(proof.value.fieldRoot);
  tamperedRootBytes[0] ^= 0xff;
  const t1 = verifyLinkProof(rootPub, genesisMsg, { ...proof.value, fieldRoot: HashOps.fromInternalBytes(tamperedRootBytes).value });
  assert.equal(t1.ok, false);

  const t2 = verifyLinkProof(rootPub, genesisMsg, { ...proof.value, prevOutpoint: { txid: txidAt(98), vout: 1 } });
  assert.equal(t2.ok, false);

  const sig = Uint8Array.from(proof.value.signature);
  sig[sig.length - 1] ^= 0xff;
  const t3 = verifyLinkProof(rootPub, genesisMsg, { ...proof.value, signature: sig });
  assert.equal(t3.ok, false);
});

test('C4-T5 link 0 proof verifies against the PKI root; a wrong root fails', () => {
  const { chain, rootPub, genesisMsg } = buildSignedChain('chain-e', 4);
  const proof = chain.linkProof(0);
  assert.equal(proof.ok, true);
  if (proof.ok) {
    assert.equal(verifyLinkProof(rootPub, genesisMsg, proof.value).ok, true);
    const wrong = buildSignedChain('chain-other', 1).rootPub;
    const r = verifyLinkProof(wrong, genesisMsg, proof.value);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason.kind, 'NotRootedAtPki');
  }
});
