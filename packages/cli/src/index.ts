#!/usr/bin/env node
// vaa — the command-line binary. Dispatches to the subcommands; every path
// returns a typed error and a non-zero exit on bad input, never a stack-only
// crash.
import { runAnchor } from './cmd_anchor.js';
import { runProve } from './cmd_prove.js';
import { runVerify } from './cmd_verify.js';
import { runQuery } from './cmd_query.js';
import { runSelftest } from './cmd_selftest.js';
import { runReproduce } from './cmd_reproduce.js';
import { runChainAppend, runChainVerify } from './cmd_chain.js';
import { runBundleIssue, runBundleVerify } from './cmd_bundle.js';

const USAGE = `vaa <command> [options]

Commands:
  anchor        --accounting-tx <file.json>     field-tree root + one-tx envelope hex
  prove         --leaves <file.json> --index n  a proof bundle
  verify        --bundle <file.json>            VerifyResult, terminating in the header chain
  query         --key <file.json>               the queried item's fragment only
  chain-append  --in <file.json>                append links; print the serialised chain
  chain-verify  --in <file.json>                verify a serialised chain
  bundle-issue  --scenario <file.json> --fields tag,tag   issue a tiny auditor bundle
  bundle-verify --bundle <file.json>            verify a bundle (inclusion + chain + anchor)
  selftest                                      exercise every layer; pass/fail per layer
  reproduce                                     regenerate and diff every deterministic vector
`;

export function run(argv: string[]): number {
  const [command, ...rest] = argv;
  switch (command) {
    case 'anchor':
      return runAnchor(rest);
    case 'prove':
      return runProve(rest);
    case 'verify':
      return runVerify(rest);
    case 'query':
      return runQuery(rest);
    case 'chain-append':
      return runChainAppend(rest);
    case 'chain-verify':
      return runChainVerify(rest);
    case 'bundle-issue':
      return runBundleIssue(rest);
    case 'bundle-verify':
      return runBundleVerify(rest);
    case 'selftest':
      return runSelftest();
    case 'reproduce':
      return runReproduce();
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      process.stdout.write(USAGE);
      return command === undefined ? 2 : 0;
    default:
      process.stderr.write(`error (BadArgs): unknown command "${command}"\n\n${USAGE}`);
      return 2;
  }
}

try {
  process.exitCode = run(process.argv.slice(2));
} catch (e) {
  process.stderr.write(`error (Failure): ${e instanceof Error ? e.message : 'unknown'}\n`);
  process.exitCode = 1;
}
