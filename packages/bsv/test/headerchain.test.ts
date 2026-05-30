import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HeaderChain, headerHash, HashOps } from '@vaa/bsv';
import { headersFixture, buildHeader } from './load.mjs';

async function headers() {
  return Promise.all(headersFixture.headers.map(buildHeader));
}

test('DA.5-T1 add three consecutive genuine headers', async () => {
  const [h179, h180, h181] = await headers();
  const chain = new HeaderChain();
  assert.equal(chain.add(h179!).ok, true);
  assert.equal(chain.add(h180!).ok, true);
  assert.equal(chain.add(h181!).ok, true);
  assert.equal(chain.height(), 2);
  assert.equal(chain.byHeight(2)!.nonce, h181!.nonce);
  assert.equal(chain.byHash(headerHash(h180!))!.height, 1);
  assert.equal(chain.containsMerkleRoot(h181!.merkleRoot)!.height, 2);
});

test('DA.5-T2 add with prev != tip -> ChainNotLinked; chain unchanged', async () => {
  const [h179, , h181] = await headers();
  const chain = new HeaderChain();
  chain.add(h179!);
  const r = chain.add(h181!); // skips 180, so prev does not match tip
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.kind, 'ChainNotLinked');
  assert.equal(chain.height(), 0);
});

test('DA.5-T3 add under-target header -> ChainTargetNotMet; chain unchanged', async () => {
  const [h179] = await headers();
  const chain = new HeaderChain();
  const hard = { ...h179!, bits: 0x03000001 };
  const r = chain.add(hard);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.kind, 'ChainTargetNotMet');
  assert.equal(chain.height(), -1);
});

test('DA.5-T4 containsMerkleRoot for present and unknown root', async () => {
  const [h179, h180, h181] = await headers();
  const chain = new HeaderChain();
  chain.add(h179!);
  chain.add(h180!);
  chain.add(h181!);
  assert.equal(chain.containsMerkleRoot(h179!.merkleRoot)!.height, 0);
  assert.equal(chain.containsMerkleRoot(HashOps.zero()), undefined);
});

test('DA.5-T5 first header on empty chain accepted if it meets target', async () => {
  const [h179] = await headers();
  const chain = new HeaderChain();
  assert.equal(chain.add(h179!).ok, true);
  assert.equal(chain.height(), 0);
});
