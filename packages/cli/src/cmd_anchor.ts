// anchor --accounting-tx <file.json> -> field-tree root + one-tx envelope hex.
import { parseArgs } from 'node:util';
import { ScriptOps, HashOps } from '@vaa/bsv';
import { buildAccountingTx } from '@vaa/evidence';
import { parseAnchorRequest } from '@vaa/api';
import { readJsonFile, printErr, printJson } from './args.js';
import { badArgs, failure } from './errors.js';

export function runAnchor(argv: string[]): number {
  let file: string | undefined;
  try {
    file = parseArgs({ args: argv, options: { 'accounting-tx': { type: 'string' } } }).values['accounting-tx'];
  } catch {
    printErr(badArgs('usage: vaa anchor --accounting-tx <file.json>'));
    return 2;
  }
  if (file === undefined) {
    printErr(badArgs('--accounting-tx <file.json> is required'));
    return 2;
  }
  const data = readJsonFile(file);
  if (!data.ok) {
    printErr(data.error);
    return 2;
  }
  const parsed = parseAnchorRequest({ accountingTransaction: data.value });
  if (!parsed.ok) {
    printErr(failure(parsed.error.message));
    return 1;
  }
  const built = buildAccountingTx(parsed.value.tx);
  if (!built.ok) {
    printErr(failure(built.error.message));
    return 1;
  }
  printJson({
    fieldTreeRootHex: HashOps.toDisplayHex(built.value.fieldTreeRoot),
    envelopeScriptsHex: built.value.lockingScripts.map((s) => ScriptOps.toHex(s)),
  });
  return 0;
}
