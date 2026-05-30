// Build a deterministic, properly-signed transaction chain for tests.
import { TxidOps, doubleSha256 } from '@vaa/bsv';
import { rootFromSeed, sign as keysSign } from '@vaa/keys';
import { TransactionChain, genesisMessage, deriveHeadPriv, deriveNextPriv, linkMessage } from '@vaa/chain';

const enc = (s) => new TextEncoder().encode(s);

export function txidAt(i) {
  const t = new Uint8Array(32);
  t[0] = i & 0xff;
  t[1] = (i >> 8) & 0xff;
  t[2] = 0x5a;
  return TxidOps.fromInternalBytes(t).value;
}

export function rootAt(i) {
  return doubleSha256(enc('fieldRoot:' + i));
}

export function buildSignedChain(seedStr, n) {
  const { rootPriv, rootPub } = rootFromSeed(enc(seedStr));
  const genesisMsg = genesisMessage(enc('entity-acme'), enc('period-2026'));
  const chain = new TransactionChain(rootPub, genesisMsg);
  const txids = [];
  const roots = [];
  const privs = [];
  for (let i = 0; i < n; i++) {
    const txid = txidAt(i);
    const root = rootAt(i);
    const priv = i === 0 ? deriveHeadPriv(rootPriv, genesisMsg) : deriveNextPriv(privs[i - 1], linkMessage(txids[i - 1], roots[i - 1], root));
    privs.push(priv);
    const prevOutpoint = i === 0 ? undefined : { txid: txids[i - 1], vout: 0 };
    const r = chain.append(txid, root, prevOutpoint, (index, message) => keysSign(priv, message));
    if (!r.ok) throw new Error('append failed: ' + JSON.stringify(r.error));
    txids.push(txid);
    roots.push(root);
  }
  return { chain, rootPub, rootPriv, genesisMsg, txids, roots, privs };
}
