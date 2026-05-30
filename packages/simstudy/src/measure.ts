// Assurance measurements over the synthetic population: inclusion proof
// generation/verification (timings local), selective-disclosure retrieval, AR
// roll-forward by recomputation, fault injection, and the honest false-origin
// boundary.
import { performance } from 'node:perf_hooks';
import type { Hash, Txid } from '@vaa/bsv';
import { TxidOps } from '@vaa/bsv';
import { heightForLeafCount, merkleProof } from '@vaa/merkle';
import { ProofStore, serializeKey } from '@vaa/proofstore';
import type { IndexKey } from '@vaa/proofstore';
import { populationLeaves, checkArRollForward, checkInvoiceTotal } from '@vaa/evidence';
import { buildPopulation, rollForwardArrays, SEED } from './population.js';
import type { ArPopulation } from './population.js';
import { FAULT_CLASSES, detectFault } from './faults.js';
import type { StudyContext } from './faults.js';

const CI_M = 240;
const REPORT_POINTS = [100000];

function txidForIndex(i: number): Txid {
  const t = new Uint8Array(32);
  t[0] = i & 0xff;
  t[1] = (i >> 8) & 0xff;
  t[2] = (i >> 16) & 0xff;
  t[3] = (i >> 24) & 0xff;
  const r = TxidOps.fromInternalBytes(t);
  if (!r.ok) throw new Error('unreachable');
  return r.value;
}

function keyForIndex(i: number): IndexKey {
  return { txid: txidForIndex(i), direction: 'output', position: i, blockPosition: i };
}

function chooseLevel(n: number): number {
  const height = heightForLeafCount(n);
  return Math.max(1, Math.min(height - 1, Math.floor(Math.log2(n) / 2)));
}

function evenlySpaced(n: number, count: number): number[] {
  const c = Math.min(n, count);
  const step = Math.max(1, Math.floor(n / c));
  const out: number[] = [];
  for (let i = 0; i < c; i++) out.push((i * step) % n);
  return out;
}

function buildContext(pop: ArPopulation): StudyContext {
  const leaves: Hash[] = populationLeaves(pop.records);
  const recordCount = pop.records.length;
  const level = chooseLevel(recordCount);
  const anchoredIndices = evenlySpaced(recordCount, Math.min(recordCount, 512));
  const store = new ProofStore(level);
  const keys: IndexKey[] = [];
  for (let i = 0; i < recordCount; i++) keys.push(keyForIndex(i));
  for (const i of anchoredIndices) {
    const r = store.anchor(keys[i] as IndexKey, leaves, i);
    if (!r.ok) throw new Error('anchor failed in assurance study: ' + JSON.stringify(r.error));
  }
  return { pop, leaves, store, keys, anchoredIndices };
}

export interface FaultSummary {
  faultClass: string;
  injected: number;
  detected: number;
  missed: number;
}

export interface AssuranceMeasurement {
  study: 'assurance';
  seed: number;
  movements: number;
  recordCount: number;
  invoiceCount: number;
  receiptCount: number;
  creditNoteCount: number;
  writeOffCount: number;
  treeHeight: number;
  predeterminedLevel: number;
  anchoredSample: number;
  rollForwardOk: boolean;
  cleanFalsePositives: number;
  faults: FaultSummary[];
  falseOriginDetected: boolean;
  selectiveDisclosureOk: boolean;
  inclusionGenVerifyMedianMs: number;
}

export function measureAssurance(seed: number, movements: number): AssuranceMeasurement {
  const pop = buildPopulation(seed, movements);
  const ctx = buildContext(pop);
  const height = heightForLeafCount(pop.records.length);

  // AR roll-forward by recomputation.
  const rollForwardOk = checkArRollForward(rollForwardArrays(pop)).ok;

  // Selective disclosure: a query returns only the queried item's fragment.
  const probe = ctx.anchoredIndices[1] ?? ctx.anchoredIndices[0]!;
  const q = ctx.store.query(ctx.keys[probe] as IndexKey);
  let selectiveDisclosureOk = false;
  if (q.ok) {
    selectiveDisclosureOk =
      q.value.leafIndex === probe && serializeKey(q.value.key) === serializeKey(ctx.keys[probe] as IndexKey);
  }

  // Zero false positives on the clean population.
  let cleanFalsePositives = 0;
  for (const i of ctx.anchoredIndices) {
    const stored = ctx.store.query(ctx.keys[i] as IndexKey);
    if (!stored.ok || !ctx.store.verify(ctx.leaves[i] as Hash, stored.value, 'adversarial').ok) cleanFalsePositives++;
  }
  if (!rollForwardOk) cleanFalsePositives++;

  // Fault injection.
  const faults: FaultSummary[] = FAULT_CLASSES.map((cls) => {
    const detected = detectFault(ctx, cls) ? 1 : 0;
    return { faultClass: cls, injected: 1, detected, missed: 1 - detected };
  });

  // Honest boundary: an internally-consistent, genuinely-anchored invoice is not
  // flagged by inclusion or by the invoice-total recomputation.
  const invoiceAnchored = ctx.anchoredIndices.find((i) => pop.records[i]!.type === 'invoice');
  let falseOriginDetected = true;
  if (invoiceAnchored !== undefined) {
    const stored = ctx.store.query(ctx.keys[invoiceAnchored] as IndexKey);
    const inclusionOk = stored.ok && ctx.store.verify(ctx.leaves[invoiceAnchored] as Hash, stored.value, 'adversarial').ok;
    const rec = pop.records[invoiceAnchored];
    const totalOk = rec !== undefined && rec.type === 'invoice' ? checkInvoiceTotal(rec).ok : false;
    falseOriginDetected = !(inclusionOk && totalOk); // both pass => not detected
  }

  // Inclusion proof generation + verification timing (local).
  const samples: number[] = [];
  for (const i of ctx.anchoredIndices.slice(0, 25)) {
    const start = performance.now();
    const p = merkleProof(ctx.leaves, i);
    if (p.ok) {
      const stored = ctx.store.query(ctx.keys[i] as IndexKey);
      if (stored.ok) ctx.store.verify(ctx.leaves[i] as Hash, stored.value, 'adversarial');
    }
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);

  return {
    study: 'assurance',
    seed,
    movements,
    recordCount: pop.records.length,
    invoiceCount: pop.invoices.length,
    receiptCount: pop.receipts.length,
    creditNoteCount: pop.creditNotes.length,
    writeOffCount: pop.writeOffs.length,
    treeHeight: height,
    predeterminedLevel: chooseLevel(pop.records.length),
    anchoredSample: ctx.anchoredIndices.length,
    rollForwardOk,
    cleanFalsePositives,
    faults,
    falseOriginDetected,
    selectiveDisclosureOk,
    inclusionGenVerifyMedianMs: samples[Math.floor(samples.length / 2)] ?? 0,
  };
}

export function ciVector(m: AssuranceMeasurement): Record<string, unknown> {
  return {
    study: m.study,
    seed: m.seed,
    movements: m.movements,
    recordCount: m.recordCount,
    invoiceCount: m.invoiceCount,
    receiptCount: m.receiptCount,
    creditNoteCount: m.creditNoteCount,
    writeOffCount: m.writeOffCount,
    treeHeight: m.treeHeight,
    predeterminedLevel: m.predeterminedLevel,
    anchoredSample: m.anchoredSample,
    rollForwardOk: m.rollForwardOk,
    cleanFalsePositives: m.cleanFalsePositives,
    faults: m.faults,
    falseOriginDetected: m.falseOriginDetected,
    selectiveDisclosureOk: m.selectiveDisclosureOk,
  };
}

export { CI_M, REPORT_POINTS, SEED };
