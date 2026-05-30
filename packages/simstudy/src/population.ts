// Deterministic synthetic AR roll-forward population whose CLEAN version balances
// exactly. Each value is an evidence object in minor units; the records are
// anchored as Bitcoin (BSV) data items (each record's canonical serialisation is
// a leaf).
import type { InvoiceFields, Payment, EvidenceObject } from '@vaa/evidence';

export const SEED = 0x5eed1234;

function prng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) >>> 0;
    s = Math.imul(s ^ (s >>> 12), 0x297a2d39) >>> 0;
    return (s ^ (s >>> 15)) >>> 0;
  };
}

export interface ArPopulation {
  open: bigint;
  invoices: InvoiceFields[];
  receipts: Payment[];
  creditNotes: Payment[];
  writeOffs: Payment[];
  close: bigint;
  records: EvidenceObject[];
}

export function buildPopulation(seed: number, movements: number): ArPopulation {
  const next = prng(seed);
  const amount = (lo: number, hi: number): bigint => BigInt(lo + (next() % (hi - lo + 1)));

  const nInvoices = Math.max(1, Math.ceil(movements * 0.5));
  const nReceipts = Math.max(1, Math.ceil(movements * 0.25));
  const nCredit = Math.max(1, Math.ceil(movements * 0.15));
  const nWrite = Math.max(1, movements - nInvoices - nReceipts - nCredit);

  const open = 1_000_000n;

  const invoices: InvoiceFields[] = [];
  for (let i = 0; i < nInvoices; i++) {
    const net = amount(100, 10000);
    const tax = net / 5n; // 20%
    const gross = net + tax;
    invoices.push({ type: 'invoice', id: `inv-${i}`, counterparty: `cp-${i % 50}`, net, tax, discount: 0n, gross });
  }
  const receipts: Payment[] = [];
  for (let i = 0; i < nReceipts; i++) receipts.push({ type: 'payment', id: `rcpt-${i}`, counterparty: `cp-${i % 50}`, amount: amount(50, 5000) });
  const creditNotes: Payment[] = [];
  for (let i = 0; i < nCredit; i++) creditNotes.push({ type: 'payment', id: `cn-${i}`, counterparty: `cp-${i % 50}`, amount: amount(10, 1000) });
  const writeOffs: Payment[] = [];
  for (let i = 0; i < nWrite; i++) writeOffs.push({ type: 'payment', id: `wo-${i}`, counterparty: `cp-${i % 50}`, amount: amount(5, 500) });

  const sumGross = invoices.reduce((a, x) => a + x.gross, 0n);
  const sumReceipts = receipts.reduce((a, x) => a + x.amount, 0n);
  const sumCredit = creditNotes.reduce((a, x) => a + x.amount, 0n);
  const sumWrite = writeOffs.reduce((a, x) => a + x.amount, 0n);
  const close = open + sumGross - sumReceipts - sumCredit - sumWrite;

  const records: EvidenceObject[] = [...invoices, ...receipts, ...creditNotes, ...writeOffs];
  return { open, invoices, receipts, creditNotes, writeOffs, close, records };
}

export function rollForwardArrays(pop: ArPopulation): {
  open: bigint;
  invoices: bigint[];
  receipts: bigint[];
  creditNotes: bigint[];
  writeOffs: bigint[];
  close: bigint;
} {
  return {
    open: pop.open,
    invoices: pop.invoices.map((x) => x.gross),
    receipts: pop.receipts.map((x) => x.amount),
    creditNotes: pop.creditNotes.map((x) => x.amount),
    writeOffs: pop.writeOffs.map((x) => x.amount),
    close: pop.close,
  };
}
