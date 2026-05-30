# @vaa/cli

The `vaa` command-line binary.

- `anchor --accounting-tx <file>` — field-tree root + one-transaction envelope hex.
- `prove --leaves <file> --index <n>` — a proof bundle.
- `verify --bundle <file>` — a VerifyResult, terminating in the header chain; refuses trusted-operational.
- `query --key <file>` — the queried item's fragment only.
- `chain-append --in <file>` / `chain-verify --in <file>` — build / verify a chain.
- `bundle-issue --scenario <file> --fields tag,tag` / `bundle-verify --bundle <file>` — issue / verify the auditor bundle.
- `selftest` — exercises every layer (incl. keys, chain, bundle, ledgermap, tripleentry, tax) and reports pass/fail per layer.
- `reproduce` — regenerates every deterministic vector and diffs against the committed outputs (non-zero exit on any mismatch).

Bad input yields a typed error and a non-zero exit, never a stack-only crash.
