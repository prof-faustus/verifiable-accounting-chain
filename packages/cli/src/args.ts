// Argument and file helpers for the CLI.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Result } from '@vaa/bsv';
import { ok, err } from '@vaa/bsv';
import type { CliError } from './errors.js';
import { fileError, badJson } from './errors.js';

export function readJsonFile(path: string): Result<unknown, CliError> {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return err(fileError(`cannot read file: ${path}`));
  }
  try {
    return ok(JSON.parse(raw) as unknown);
  } catch {
    return err(badJson(`invalid JSON in file: ${path}`));
  }
}

export function repoRoot(): string {
  return join(import.meta.dirname, '..', '..', '..');
}

export function printErr(e: CliError): void {
  process.stderr.write(`error (${e.kind}): ${e.message}\n`);
}

export function printJson(value: unknown): void {
  process.stdout.write(JSON.stringify(value, null, 2) + '\n');
}

// Unwrap a Result whose error is unreachable in context (e.g. a known-valid hex).
export function must<T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!r.ok) throw new Error('unexpected error: ' + JSON.stringify(r.error));
  return r.value;
}
