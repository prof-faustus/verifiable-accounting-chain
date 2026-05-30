// The verification trust root: an append-only, self-validating header chain.
// Nothing outside this validated chain is ever trusted.
import type { Result } from './result.js';
import { ok, err } from './result.js';
import type { BsvError } from './errors.js';
import { chainNotLinked, chainTargetNotMet } from './errors.js';
import type { Hash } from './hash.js';
import { equals, toDisplayHex } from './hash.js';
import type { BlockHeader } from './header.js';
import { headerHash, meetsTarget } from './header.js';

export class HeaderChain {
  private readonly headers: BlockHeader[] = [];
  private readonly byHashMap = new Map<string, number>();
  private readonly byRootMap = new Map<string, number>();

  add(h: BlockHeader): Result<void, BsvError> {
    if (this.headers.length > 0) {
      const tip = this.headers[this.headers.length - 1] as BlockHeader;
      const tipHash = headerHash(tip);
      if (!equals(h.prevBlockHash, tipHash)) {
        return err(chainNotLinked(toDisplayHex(tipHash), toDisplayHex(h.prevBlockHash)));
      }
    }
    if (!meetsTarget(h)) {
      return err(chainTargetNotMet(toDisplayHex(headerHash(h))));
    }
    const idx = this.headers.length;
    this.headers.push(h);
    this.byHashMap.set(toDisplayHex(headerHash(h)), idx);
    this.byRootMap.set(toDisplayHex(h.merkleRoot), idx);
    return ok(undefined);
  }

  height(): number {
    return this.headers.length - 1;
  }

  byHeight(n: number): BlockHeader | undefined {
    return this.headers[n];
  }

  byHash(hash: Hash): { header: BlockHeader; height: number } | undefined {
    const idx = this.byHashMap.get(toDisplayHex(hash));
    if (idx === undefined) return undefined;
    return { header: this.headers[idx] as BlockHeader, height: idx };
  }

  containsMerkleRoot(root: Hash): { height: number } | undefined {
    const idx = this.byRootMap.get(toDisplayHex(root));
    if (idx === undefined) return undefined;
    return { height: idx };
  }
}
