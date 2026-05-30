// Synthetic-population assurance study runner. With --ci it runs only the small
// CI point (and writes its reproducible vector); otherwise it also runs the large
// report point. Absolute timings are local.
import { parseArgs } from 'node:util';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { measureAssurance, ciVector, CI_M, REPORT_POINTS, SEED } from './measure.js';

function repoRoot(): string {
  return join(import.meta.dirname, '..', '..', '..');
}

export function vectorPath(m: number): string {
  return join(repoRoot(), 'vectors', 'study', `simstudy_${m}.json`);
}

function main(): void {
  const { values } = parseArgs({ options: { ci: { type: 'boolean', default: false } } });
  const points = values.ci ? [CI_M] : [...REPORT_POINTS, CI_M];
  for (const m of points) {
    const measurement = measureAssurance(SEED, m);
    process.stdout.write('ASSURANCE ' + JSON.stringify(measurement) + '\n');
  }
  const vec = ciVector(measureAssurance(SEED, CI_M));
  mkdirSync(join(repoRoot(), 'vectors', 'study'), { recursive: true });
  writeFileSync(vectorPath(CI_M), JSON.stringify(vec, null, 2) + '\n');
  process.stdout.write(`ASSURANCE_VECTOR_WRITTEN ${vectorPath(CI_M)}\n`);
}

main();
