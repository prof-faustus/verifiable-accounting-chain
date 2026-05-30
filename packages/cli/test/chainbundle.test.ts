import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HashOps, TxidOps, doubleSha256 } from '@vaa/bsv';
import { numericValue } from '@vaa/evidence';
import { runCli, tmpFile } from './util.mjs';

const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');
const enc = (s: string) => new TextEncoder().encode(s);

test('F.4 chain-append then chain-verify', () => {
  const links = [0, 1, 2].map((i) => ({
    txidHex: TxidOps.toDisplayHex(TxidOps.fromInternalBytes(new Uint8Array(32).fill(i + 1)).value),
    fieldRootHex: HashOps.toDisplayHex(doubleSha256(enc('r' + i))),
  }));
  const scenario = tmpFile('chain-scenario.json', { seed: 's', entity: 'e', period: 'p', links });
  const appended = runCli(['chain-append', '--in', scenario]);
  assert.equal(appended.status, 0);
  const out = JSON.parse(appended.stdout) as { headPubHex: string; links: unknown[]; verify: boolean };
  assert.equal(out.verify, true);
  assert.equal(out.links.length, 3);

  const chainFile = tmpFile('chain.json', { headPubHex: out.headPubHex, links: out.links });
  const verified = runCli(['chain-verify', '--in', chainFile]);
  assert.equal(verified.status, 0);
  assert.match(verified.stdout, /"ok": true/);
});

test('F.4 bundle-issue then bundle-verify', () => {
  const accountingTx = {
    kind: 'journal',
    fields: [
      { tag: 'tax.vatPayable', valueHex: hex(numericValue(120n)) },
      { tag: 'customer.name', valueHex: hex(numericValue(999n)) },
    ],
  };
  const scenario = tmpFile('bundle-scenario.json', { seed: 's', entity: 'e', period: 'p', accountingTx });
  const issued = runCli(['bundle-issue', '--scenario', scenario, '--fields', 'tax.vatPayable']);
  assert.equal(issued.status, 0);
  const out = JSON.parse(issued.stdout) as Record<string, unknown>;
  assert.ok(out['bundle'] !== undefined);

  const bundleFile = tmpFile('bundle.json', out);
  const verified = runCli(['bundle-verify', '--bundle', bundleFile]);
  assert.equal(verified.status, 0);
  assert.match(verified.stdout, /"ok": true/);
});

test('F.4 bundle-verify error path on a tampered bundle', () => {
  const accountingTx = { kind: 'journal', fields: [{ tag: 'tax.vatPayable', valueHex: hex(numericValue(120n)) }] };
  const scenario = tmpFile('bs2.json', { seed: 's', entity: 'e', period: 'p', accountingTx });
  const issued = runCli(['bundle-issue', '--scenario', scenario, '--fields', 'tax.vatPayable']);
  const out = JSON.parse(issued.stdout) as { bundle: { disclosedFields: { tag: string; valueHex: string }[] } };
  const h = out.bundle.disclosedFields[0]!.valueHex;
  out.bundle.disclosedFields[0]!.valueHex = h.slice(0, -1) + (h.slice(-1) === '0' ? '1' : '0');
  const bundleFile = tmpFile('bundle-bad.json', out);
  const verified = runCli(['bundle-verify', '--bundle', bundleFile]);
  assert.notEqual(verified.status, 0);
});
