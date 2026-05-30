// Node access. OfflineNodeClient serves genuine fixtures deterministically (CI
// uses it with no network). LiveNodeClient talks to a BSV node (Teranode target)
// through an injected transport; every failure surfaces as a typed NodeError and
// there is never an unhandled rejection.
import type { Result } from './result.js';
import { ok, err } from './result.js';
import type { BsvError } from './errors.js';
import { nodeNotFound, nodeUnreachable, nodeBadResponse } from './errors.js';
import type { Txid } from './txid.js';
import { toDisplayHex as txidDisplay } from './txid.js';
import type { Hash } from './hash.js';
import { toDisplayHex as hashDisplay } from './hash.js';
import type { Transaction } from './transaction.js';
import { parseTransaction } from './transaction.js';
import type { BlockHeader } from './header.js';
import { parseHeader } from './header.js';
import { fromHex } from './bytes.js';
import { fromDisplayHex as txidFromDisplay } from './txid.js';

export interface NodeClient {
  getTransaction(txid: Txid): Promise<Result<Transaction, BsvError>>;
  getBlockTxids(blockHash: Hash): Promise<Result<Txid[], BsvError>>;
  getHeader(blockHash: Hash): Promise<Result<BlockHeader, BsvError>>;
  getHeadersFrom(height: number, count: number): Promise<Result<BlockHeader[], BsvError>>;
}

export interface OfflineDataset {
  transactionsByTxid: Map<string, Uint8Array>;
  blockTxids: Map<string, Txid[]>;
  headerByBlockHash: Map<string, BlockHeader>;
  headersByHeight: BlockHeader[];
}

export class OfflineNodeClient implements NodeClient {
  private readonly data: OfflineDataset;
  constructor(data: OfflineDataset) {
    this.data = data;
  }

  async getTransaction(txid: Txid): Promise<Result<Transaction, BsvError>> {
    const raw = this.data.transactionsByTxid.get(txidDisplay(txid));
    if (raw === undefined) return err(nodeNotFound(`transaction ${txidDisplay(txid)}`));
    return parseTransaction(raw);
  }

  async getBlockTxids(blockHash: Hash): Promise<Result<Txid[], BsvError>> {
    const txids = this.data.blockTxids.get(hashDisplay(blockHash));
    if (txids === undefined) return err(nodeNotFound(`block ${hashDisplay(blockHash)}`));
    return ok(txids.map((t) => t));
  }

  async getHeader(blockHash: Hash): Promise<Result<BlockHeader, BsvError>> {
    const header = this.data.headerByBlockHash.get(hashDisplay(blockHash));
    if (header === undefined) return err(nodeNotFound(`header ${hashDisplay(blockHash)}`));
    return ok(header);
  }

  async getHeadersFrom(height: number, count: number): Promise<Result<BlockHeader[], BsvError>> {
    const out: BlockHeader[] = [];
    for (let i = 0; i < count; i++) {
      const h = this.data.headersByHeight[height + i];
      if (h === undefined) return err(nodeNotFound(`header at height ${height + i}`));
      out.push(h);
    }
    return ok(out);
  }
}

// Injected transport. A successful request yields a body; a missing resource
// yields notFound; any network error or timeout yields unreachable.
export type TransportResult =
  | { kind: 'ok'; body: string }
  | { kind: 'notFound' }
  | { kind: 'unreachable'; detail: string };

export interface Transport {
  request(path: string): Promise<TransportResult>;
}

export class LiveNodeClient implements NodeClient {
  private readonly transport: Transport;
  constructor(transport: Transport) {
    this.transport = transport;
  }

  private async fetch(path: string, what: string): Promise<Result<string, BsvError>> {
    let r: TransportResult;
    try {
      r = await this.transport.request(path);
    } catch (e) {
      return err(nodeUnreachable(e instanceof Error ? e.message : 'transport threw'));
    }
    if (r.kind === 'unreachable') return err(nodeUnreachable(r.detail));
    if (r.kind === 'notFound') return err(nodeNotFound(what));
    return ok(r.body);
  }

  async getTransaction(txid: Txid): Promise<Result<Transaction, BsvError>> {
    const body = await this.fetch(`/tx/${txidDisplay(txid)}/hex`, `transaction ${txidDisplay(txid)}`);
    if (!body.ok) return err(body.error);
    const bytes = fromHex(body.value.trim());
    if (!bytes.ok) return err(nodeBadResponse('transaction body is not hex'));
    const tx = parseTransaction(bytes.value);
    if (!tx.ok) return err(nodeBadResponse('transaction body did not parse'));
    return ok(tx.value);
  }

  async getBlockTxids(blockHash: Hash): Promise<Result<Txid[], BsvError>> {
    const body = await this.fetch(`/block/${hashDisplay(blockHash)}/txids`, `block ${hashDisplay(blockHash)}`);
    if (!body.ok) return err(body.error);
    let arr: unknown;
    try {
      arr = JSON.parse(body.value);
    } catch {
      return err(nodeBadResponse('block txids body is not JSON'));
    }
    if (!Array.isArray(arr)) return err(nodeBadResponse('block txids body is not an array'));
    const out: Txid[] = [];
    for (const item of arr) {
      if (typeof item !== 'string') return err(nodeBadResponse('txid entry is not a string'));
      const t = txidFromDisplay(item);
      if (!t.ok) return err(nodeBadResponse('txid entry is not a valid txid'));
      out.push(t.value);
    }
    return ok(out);
  }

  async getHeader(blockHash: Hash): Promise<Result<BlockHeader, BsvError>> {
    const body = await this.fetch(`/block/${hashDisplay(blockHash)}/header/raw`, `header ${hashDisplay(blockHash)}`);
    if (!body.ok) return err(body.error);
    const bytes = fromHex(body.value.trim());
    if (!bytes.ok) return err(nodeBadResponse('header body is not hex'));
    const header = parseHeader(bytes.value);
    if (!header.ok) return err(nodeBadResponse('header body did not parse'));
    return ok(header.value);
  }

  async getHeadersFrom(height: number, count: number): Promise<Result<BlockHeader[], BsvError>> {
    const body = await this.fetch(`/headers/${height}/${count}/raw`, `headers from ${height}`);
    if (!body.ok) return err(body.error);
    let arr: unknown;
    try {
      arr = JSON.parse(body.value);
    } catch {
      return err(nodeBadResponse('headers body is not JSON'));
    }
    if (!Array.isArray(arr)) return err(nodeBadResponse('headers body is not an array'));
    const out: BlockHeader[] = [];
    for (const item of arr) {
      if (typeof item !== 'string') return err(nodeBadResponse('header entry is not a string'));
      const bytes = fromHex(item.trim());
      if (!bytes.ok) return err(nodeBadResponse('header entry is not hex'));
      const header = parseHeader(bytes.value);
      if (!header.ok) return err(nodeBadResponse('header entry did not parse'));
      out.push(header.value);
    }
    return ok(out);
  }
}
