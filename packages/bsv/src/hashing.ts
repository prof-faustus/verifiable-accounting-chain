// The single hashing site for the whole project. Double-SHA256 is performed via
// the SDK; no package computes a hash directly, and there is no single-SHA-256
// export. hashNode is the only internal-node hashing function.
import { Hash as SdkHash } from '@bsv/sdk';
import type { Hash } from './hash.js';
import { fromInternalBytes, toInternalBytes } from './hash.js';
import { concat } from './bytes.js';
import { throwBsv, hashBadLength } from './errors.js';

export function doubleSha256(data: Uint8Array): Hash {
  // SHA-256 applied twice via the SDK; result is a 32-byte internal-order Hash.
  const digest = SdkHash.hash256(Array.from(data));
  const wrapped = fromInternalBytes(Uint8Array.from(digest));
  if (!wrapped.ok) {
    // Unreachable: hash256 always returns 32 bytes. Surface as programmer misuse.
    throwBsv(hashBadLength(digest.length));
  }
  return wrapped.value;
}

export function hashLeaf(dataItem: Uint8Array): Hash {
  return doubleSha256(dataItem);
}

export function hashNode(left: Hash, right: Hash): Hash {
  return doubleSha256(concat(toInternalBytes(left), toInternalBytes(right)));
}
