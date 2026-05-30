import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HashOps } from '@vaa/bsv';
import { serializeStructure, mappingRoot, verifyMappingRoot } from '@vaa/ledgermap';
import { sampleStructure } from './util.mjs';

test('LM4-T1 serialize deterministic; mappingRoot stable; verifyMappingRoot ok', () => {
  const s = sampleStructure();
  assert.deepEqual(Array.from(serializeStructure(s)), Array.from(serializeStructure(s)));
  assert.equal(HashOps.toDisplayHex(mappingRoot(s)), HashOps.toDisplayHex(mappingRoot(s)));
  assert.equal(verifyMappingRoot(s, mappingRoot(s)).ok, true);
});

test('LM4-T2 changing any node/label/tag changes mappingRoot', () => {
  const base = HashOps.toDisplayHex(mappingRoot(sampleStructure()));

  const relabel = sampleStructure();
  relabel.root.children[0]!.label = 'Changed Ledger';
  assert.notEqual(HashOps.toDisplayHex(mappingRoot(relabel)), base);

  const retag = sampleStructure();
  retag.root.children[0]!.children[0]!.fieldTags = ['balance', 'CHANGED'];
  assert.notEqual(HashOps.toDisplayHex(mappingRoot(retag)), base);

  const reversion = sampleStructure();
  reversion.version = 2;
  assert.notEqual(HashOps.toDisplayHex(mappingRoot(reversion)), base);

  // an altered structure fails verifyMappingRoot against the original root
  assert.equal(verifyMappingRoot(relabel, mappingRoot(sampleStructure())).ok, false);
});
