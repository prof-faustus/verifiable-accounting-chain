import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heightForLeafCount } from '@vaa/merkle';
import { measureBundlePoint, measureBundleSizes } from '@vaa/simstore';

test('G.5 the auditor bundle is small and independent of the total field count', () => {
  for (const n of [256, 4096, 16384]) {
    const p = measureBundlePoint(n);
    assert.equal(p.verifies, true);
    assert.equal(p.disclosedFields, 1); // one disclosed field regardless of n
    assert.equal(p.pathSiblings, heightForLeafCount(n)); // log-sized path, not O(n)
  }
  // the path grows logarithmically, not linearly
  const points = measureBundleSizes();
  assert.ok(points[1]!.pathSiblings - points[0]!.pathSiblings < 8);
  assert.ok(points[0]!.disclosedFields === points[1]!.disclosedFields);
});
