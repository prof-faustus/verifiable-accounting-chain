// Test helpers for proofstore: deterministic leaves and index keys.
import { hashLeaf, TxidOps } from '@vaa/bsv';

export function makeLeaves(seed, n) {
  let s = seed >>> 0;
  const out = [];
  for (let i = 0; i < n; i++) {
    s = (s + 0x9e3779b9) >>> 0;
    const b = new Uint8Array(8);
    for (let j = 0; j < 8; j++) {
      s = (Math.imul(s ^ (s >>> 13), 0x5bd1e995)) >>> 0;
      b[j] = s & 0xff;
    }
    out.push(hashLeaf(b));
  }
  return out;
}

export function makeKey(i) {
  const t = new Uint8Array(32);
  t[0] = i & 0xff;
  t[1] = (i >> 8) & 0xff;
  t[2] = (i >> 16) & 0xff;
  return {
    txid: TxidOps.fromInternalBytes(t).value,
    direction: 'output',
    position: i,
    blockPosition: i,
  };
}

export function unwrap(r) {
  if (!r.ok) throw new Error('expected ok, got: ' + JSON.stringify(r.error));
  return r.value;
}
