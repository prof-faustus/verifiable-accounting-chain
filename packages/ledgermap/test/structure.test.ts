import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateStructure, enumerateFields } from '@vaa/ledgermap';
import { sampleStructure, bigStructure } from './util.mjs';

test('LM2-T1 a valid multi-level structure validates; enumerateFields in order', () => {
  const s = sampleStructure();
  assert.equal(validateStructure(s).ok, true);
  const fields = enumerateFields(s);
  assert.deepEqual(
    fields.map((f) => f.path.join('/') + ':' + f.tag),
    ['GL/1000-Cash:balance', 'GL/1000-Cash:movement', 'GL/4000-Sales:net', 'GL/4000-Sales:tax'],
  );
});

test('LM2-T2 duplicate sibling -> BadPath{duplicate}; empty segment -> BadPath{empty}', () => {
  const dup = sampleStructure();
  dup.root.children[0]!.children.push({ path: ['GL', '1000-Cash'], label: 'Dup', accountType: 'asset', children: [], fieldTags: ['x'] });
  const rd = validateStructure(dup);
  assert.equal(rd.ok, false);
  if (!rd.ok) assert.equal(rd.error.kind === 'BadPath' && rd.error.reason, 'duplicate');

  const empty = sampleStructure();
  empty.root.children[0]!.children.push({ path: ['GL', ''], label: 'Empty', accountType: 'asset', children: [], fieldTags: ['x'] });
  const re = validateStructure(empty);
  assert.equal(re.ok, false);
  if (!re.ok) assert.equal(re.error.kind === 'BadPath' && re.error.reason, 'empty');
});

test('LM2-T3 a 1000-field structure enumerates 1000 pairs deterministically', () => {
  const s = bigStructure(1000);
  assert.equal(validateStructure(s).ok, true);
  const a = enumerateFields(s);
  const b = enumerateFields(s);
  assert.equal(a.length, 1000);
  assert.deepEqual(a.map((x) => x.tag), b.map((x) => x.tag));
});
