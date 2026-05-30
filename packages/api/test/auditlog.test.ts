import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuditLog } from '@vaa/api';

test('E.5 T-al-1 a proof response writes one metadata-only entry', () => {
  const log = new AuditLog();
  log.record({ ts: '2026-05-30T00:00:00.000Z', callerId: 'apiKey:k', queryKeyHex: 't:..|d:1', returnedFragmentId: 'abcd:5', outcome: 'served' });
  assert.equal(log.size(), 1);
  assert.equal(log.all()[0]!.outcome, 'served');
});

test('E.5 T-al-2 no underlying record content appears in the entry', () => {
  const log = new AuditLog();
  const secretRecordContent = 'INVOICE NET 100 TAX 21';
  log.record({ ts: '2026-05-30T00:00:00.000Z', callerId: 'apiKey:k', queryKeyHex: 'keyhex', returnedFragmentId: 'root16:3', outcome: 'served' });
  const serialised = JSON.stringify(log.all());
  assert.equal(serialised.includes(secretRecordContent), false);
  // entry has exactly the metadata fields
  assert.deepEqual(Object.keys(log.all()[0]!).sort(), ['callerId', 'outcome', 'queryKeyHex', 'returnedFragmentId', 'ts']);
});
