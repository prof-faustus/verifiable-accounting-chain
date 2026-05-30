# @vaa/cli

The `vaa` command-line binary.

- `anchor --accounting-tx <file>` — field-tree root + one-transaction envelope hex.
- `prove --leaves <file> --index <n>` — a proof bundle.
- `verify --bundle <file>` — a VerifyResult, terminating in the header chain; refuses trusted-operational.
- `query --key <file>` — the queried item's fragment only.
- `selftest` — exercises every layer and reports pass/fail per layer.
- `reproduce` — regenerates every deterministic vector and diffs against the committed outputs (non-zero exit on any mismatch).

Bad input yields a typed error and a non-zero exit, never a stack-only crash.
