// One-time tooling: fetch GENUINE Bitcoin (BSV) data from a public BSV explorer
// and write it as committed fixtures/vectors. Reproduction never re-fetches; it
// recomputes deterministically from these genuine records. Run manually:
//   NODE_OPTIONS=--use-system-ca node scripts/fetch-fixtures.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Transaction } from '@bsv/sdk';

const BASE = 'https://api.whatsonchain.com/v1/bsv/main';
const root = resolve(import.meta.dirname, '..');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url);
    if (res.status === 200) return res.json();
    if (res.status === 404) return null;
    await sleep(800 * (attempt + 1));
  }
  throw new Error('giving up on ' + url);
}

async function getText(url) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url);
    if (res.status === 200) return (await res.text()).trim();
    if (res.status === 404) return null;
    await sleep(800 * (attempt + 1));
  }
  throw new Error('giving up on ' + url);
}

function bitsToInt(bits) {
  if (typeof bits === 'number') return bits >>> 0;
  return parseInt(bits, 16) >>> 0;
}

async function blockByHeight(h) {
  await sleep(350);
  return getJson(`${BASE}/block/height/${h}`);
}

// 1) Find a small early block whose full ordered txid list is returned inline.
async function findSmallBlock() {
  for (let h = 175; h <= 5000; h++) {
    const b = await blockByHeight(h);
    if (!b) continue;
    const numTx = b.num_tx ?? (Array.isArray(b.tx) ? b.tx.length : 0);
    if (Array.isArray(b.tx) && b.tx.length === numTx && numTx >= 2 && numTx <= 8) {
      return b;
    }
  }
  return null;
}

async function main() {
  const merkleBlock = await findSmallBlock();
  if (!merkleBlock) throw new Error('no suitable small multi-tx block found');
  const h = merkleBlock.height;
  console.log(`merkle block: height ${h}, ${merkleBlock.tx.length} txs, hash ${merkleBlock.hash}`);

  // Three consecutive headers ending at the merkle block: h-2, h-1, h.
  const consec = [];
  for (const hh of [h - 2, h - 1, h]) {
    const b = hh === h ? merkleBlock : await blockByHeight(hh);
    consec.push({
      height: b.height,
      version: b.version,
      previousblockhash: b.previousblockhash,
      merkleroot: b.merkleroot,
      time: b.time,
      bits: bitsToInt(b.bits),
      nonce: b.nonce,
      hash: b.hash,
    });
  }

  // A genuine multi-in / multi-out transaction: scan a recent block's first-page
  // txids for one with >= 2 inputs and >= 2 outputs.
  const tip = await getJson(`${BASE}/chain/info`);
  const tipHeight = tip.blocks;
  let multiTx = null;
  for (let back = 6; back < 40 && !multiTx; back++) {
    const b = await blockByHeight(tipHeight - back);
    if (!b || !Array.isArray(b.tx)) continue;
    for (const txid of b.tx.slice(0, 20)) {
      const hex = await getText(`${BASE}/tx/${txid}/hex`);
      await sleep(250);
      if (!hex) continue;
      const tx = Transaction.fromHex(hex);
      if (tx.inputs.length >= 2 && tx.outputs.length >= 2) {
        multiTx = { txid, hex, blockHeight: b.height };
        break;
      }
    }
  }
  if (!multiTx) throw new Error('no multi-in/multi-out tx found');

  const tx = Transaction.fromHex(multiTx.hex);
  const computedTxid = tx.id('hex');
  console.log(`tx: ${multiTx.txid}, inputs ${tx.inputs.length}, outputs ${tx.outputs.length}, recomputed ${computedTxid}`);

  const txFixture = {
    source: `Bitcoin (BSV) mainnet transaction ${multiTx.txid}, block height ${multiTx.blockHeight}, retrieved from a public BSV explorer`,
    txid: multiTx.txid,
    rawHex: multiTx.hex,
    inputCount: tx.inputs.length,
    outputCount: tx.outputs.length,
    outputs: tx.outputs.map((o, i) => ({
      position: i,
      amountMinorUnits: String(o.satoshis ?? 0),
      lockingScriptHex: o.lockingScript.toHex(),
      lockingScriptLength: o.lockingScript.toBinary().length,
    })),
  };

  const blockVector = {
    source: `Bitcoin (BSV) mainnet block at height ${h}, retrieved from a public BSV explorer`,
    height: h,
    blockHash: merkleBlock.hash,
    version: merkleBlock.version,
    previousBlockHash: merkleBlock.previousblockhash,
    merkleRoot: merkleBlock.merkleroot,
    time: merkleBlock.time,
    bits: bitsToInt(merkleBlock.bits),
    nonce: merkleBlock.nonce,
    txids: merkleBlock.tx,
  };

  const headersFixture = {
    source: `Bitcoin (BSV) mainnet consecutive block headers at heights ${h - 2}..${h}, retrieved from a public BSV explorer`,
    headers: consec,
  };

  mkdirSync(join(root, 'vectors', 'merkle'), { recursive: true });
  mkdirSync(join(root, 'packages', 'bsv', 'test', 'fixtures'), { recursive: true });

  const write = (p, obj) => writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
  write(join(root, 'vectors', 'merkle', 'bsv_block_v1.json'), blockVector);
  write(join(root, 'packages', 'bsv', 'test', 'fixtures', 'transaction.json'), txFixture);
  write(join(root, 'packages', 'bsv', 'test', 'fixtures', 'headers.json'), headersFixture);
  write(join(root, 'packages', 'bsv', 'test', 'fixtures', 'block.json'), blockVector);
  console.log('fixtures written.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
