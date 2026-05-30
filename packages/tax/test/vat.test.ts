import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recomputeVat, verifyVatDeclaration, collectTaxFields, checkRate } from '@vaa/tax';
import { vatReturnTx, taxMap, ACCOUNT_PATH } from './util.mjs';

function period() {
  return [{ tx: vatReturnTx(200n, 80n) }, { tx: vatReturnTx(100n, 30n) }];
}

test('TX2-T1 tax fields collect across a period and are mapped under the structure root', () => {
  const { map } = taxMap();
  const collected = collectTaxFields(map, ACCOUNT_PATH, period());
  assert.equal(collected.ok, true);
  if (collected.ok) {
    assert.deepEqual(collected.value.outputs, [200n, 100n]);
    assert.deepEqual(collected.value.inputs, [80n, 30n]);
  }
});

test('TX2-T2 a rate outside the permitted set -> RateNotPermitted', () => {
  assert.equal(checkRate(2000).ok, true);
  const r = checkRate(1234);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.kind, 'RateNotPermitted');
});

test('TX3-T1 a consistent declaration verifies', () => {
  const { map } = taxMap();
  const txs = period();
  const computed = recomputeVat(map, ACCOUNT_PATH, txs);
  assert.equal(computed.ok, true);
  if (computed.ok) assert.equal(verifyVatDeclaration(map, ACCOUNT_PATH, txs, computed.value).ok, true);
});

test('TX3-T2 a declared payable that disagrees -> TaxRecomputeMismatch{payable}', () => {
  const { map } = taxMap();
  const txs = period();
  const r = verifyVatDeclaration(map, ACCOUNT_PATH, txs, { outputTax: 300n, inputTax: 110n, payable: 999n });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.reason.kind, 'TaxRecomputeMismatch');
    if (r.reason.kind === 'TaxRecomputeMismatch') assert.equal(r.reason.measure, 'payable');
  }
});

test('TX3-T3 recomputation is bigint/overflow-safe (period sum exceeds 2^64)', () => {
  const { map } = taxMap();
  const perTx = 10n ** 18n; // fits one 8-byte field, > 2^53
  const txs = Array.from({ length: 50 }, () => ({ tx: vatReturnTx(perTx, 0n) }));
  const computed = recomputeVat(map, ACCOUNT_PATH, txs);
  assert.equal(computed.ok, true);
  // 50 * 10^18 = 5*10^19 > 2^64; bigint sums it without overflow
  if (computed.ok) assert.equal(computed.value.outputTax, 50n * perTx);
});
