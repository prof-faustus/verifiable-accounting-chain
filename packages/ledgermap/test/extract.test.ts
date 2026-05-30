import { test } from 'node:test';
import assert from 'node:assert/strict';
import { numericValue } from '@vaa/evidence';
import { extractField } from '@vaa/ledgermap';
import { sampleMap } from './util.mjs';

function txWithNet(net: bigint, withOther: boolean) {
  const fields = [{ tag: 'net', value: numericValue(net) }];
  if (withOther) fields.push({ tag: 'secret', value: numericValue(999999n) });
  return { tx: { kind: 'invoice' as const, fields } };
}

test('LM5-T1 extractField returns N values in order; an unrelated field never appears', () => {
  const { map } = sampleMap();
  const txs = [txWithNet(100n, true), txWithNet(200n, true), txWithNet(300n, true)];
  const values = extractField(map, ['GL', '4000-Sales'], 'net', txs);
  assert.equal(values.length, 3);
  assert.deepEqual(Array.from(values[0]!.value), Array.from(numericValue(100n)));
  assert.deepEqual(Array.from(values[2]!.value), Array.from(numericValue(300n)));
  const secret = numericValue(999999n);
  for (const v of values) assert.notDeepEqual(Array.from(v.value), Array.from(secret));
});

test('LM5-T2 a transaction not carrying the field is skipped', () => {
  const { map } = sampleMap();
  const txs = [txWithNet(100n, false), { tx: { kind: 'invoice' as const, fields: [{ tag: 'tax', value: numericValue(5n) }] } }, txWithNet(300n, false)];
  const values = extractField(map, ['GL', '4000-Sales'], 'net', txs);
  assert.equal(values.length, 2);
});
