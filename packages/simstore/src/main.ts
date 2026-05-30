// Storage / retrieval efficiency study runner. With --ci it runs only the small
// CI point (and writes its reproducible vector); otherwise it also runs the large
// report points, printing machine-readable lines. Absolute timings are local.
import { parseArgs } from 'node:util';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { measureStorage, ciVector } from './measure.js';
import { SEED } from './population.js';

const CI_N = 256;
const REPORT_POINTS = [1024, 16384, 262144];

function repoRoot(): string {
  return join(import.meta.dirname, '..', '..', '..');
}

export function vectorPath(n: number): string {
  return join(repoRoot(), 'vectors', 'study', `storage_${n}.json`);
}

function main(): void {
  const { values } = parseArgs({ options: { ci: { type: 'boolean', default: false } } });
  const points = values.ci ? [CI_N] : [...REPORT_POINTS, CI_N];
  for (const n of points) {
    const m = measureStorage(SEED, n);
    process.stdout.write('STORAGE ' + JSON.stringify(m) + '\n');
  }
  const vec = ciVector(measureStorage(SEED, CI_N));
  mkdirSync(join(repoRoot(), 'vectors', 'study'), { recursive: true });
  writeFileSync(vectorPath(CI_N), JSON.stringify(vec, null, 2) + '\n');
  process.stdout.write(`STORAGE_VECTOR_WRITTEN ${vectorPath(CI_N)}\n`);
}

main();
