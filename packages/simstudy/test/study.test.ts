import { test } from 'node:test';
import assert from 'node:assert/strict';
import { measureAssurance, ciVector, SEED, CI_M } from '@vaa/simstudy';

test('H.6 T-study-1 zero false positives on the clean population', () => {
  const m = measureAssurance(SEED, CI_M);
  assert.equal(m.rollForwardOk, true);
  assert.equal(m.cleanFalsePositives, 0);
  assert.equal(m.selectiveDisclosureOk, true);
});

test('H.6 T-study-2 each in-scope fault class is detected', () => {
  const m = measureAssurance(SEED, CI_M);
  assert.equal(m.faults.length, 7);
  for (const f of m.faults) {
    assert.equal(f.injected, 1);
    assert.equal(f.detected, 1, `${f.faultClass} should be detected`);
    assert.equal(f.missed, 0);
  }
});

test('H.6 T-study-3 the false-origin boundary is asserted as NOT detected', () => {
  const m = measureAssurance(SEED, CI_M);
  assert.equal(m.falseOriginDetected, false);
});

test('H.6 T-study-4 the CI-point vector regenerates byte-identically', () => {
  const a = JSON.stringify(ciVector(measureAssurance(SEED, CI_M)));
  const b = JSON.stringify(ciVector(measureAssurance(SEED, CI_M)));
  assert.equal(a, b);
});
