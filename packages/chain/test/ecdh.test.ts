import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pointMulG, pointEq, scalarMod } from '@vaa/bsv';
import { commonSecret } from '@vaa/chain';

const enc = (s: string) => new TextEncoder().encode(s);

test('C5-T1 two parties derive the same common secret from mirrored inputs', () => {
  const aPriv = scalarMod(111111111111111111n);
  const bPriv = scalarMod(222222222222222222n);
  const aPub = pointMulG(aPriv);
  const bPub = pointMulG(bPriv);
  const m = enc('deliver bundle to auditor key');
  const csA = commonSecret(aPriv, bPub, m);
  const csB = commonSecret(bPriv, aPub, m);
  assert.equal(pointEq(csA, csB), true);
});

test('C5-T2 a different message or counterparty yields a different secret', () => {
  const aPriv = scalarMod(333n);
  const bPriv = scalarMod(444n);
  const bPub = pointMulG(bPriv);
  const cPub = pointMulG(scalarMod(555n));
  const base = commonSecret(aPriv, bPub, enc('m1'));
  assert.equal(pointEq(base, commonSecret(aPriv, bPub, enc('m2'))), false);
  assert.equal(pointEq(base, commonSecret(aPriv, cPub, enc('m1'))), false);
});
