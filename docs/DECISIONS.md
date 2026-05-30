# Decisions

This is the living record of engineering decisions, including every point the
specification left open and how it was resolved. Each entry states the decision
and the reason.

## D1 — Stack and toolchain

- **Language/runtime:** TypeScript 5.7 in strict mode (`strict`,
  `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`,
  plus `noUnusedLocals/Parameters`, `noImplicitReturns`), Node.js 24 LTS, ESM,
  NodeNext resolution.
- **Workspace:** npm workspaces + `tsc -b` project references. No third-party
  task runner, bundler, or monorepo orchestrator is used, so nothing in the repo
  names a build tool and the lockfile (scanned for prohibited tokens) stays tiny.
- **Supporting roles from the standard library:** the test runner (`node:test`),
  assertions (`node:assert`), argument parser (`node:util` `parseArgs`), HTTP
  server (`node:http`), and timing (`node:perf_hooks`) are all Node built-ins.
  The structured logger, schema validators, seeded RNG, and property-test
  generators are implemented in-tree. **Reason:** the specification permits these
  supporting libraries but does not require external ones; minimising third-party
  packages minimises the lockfile surface that the forbidden-token scan must keep
  clean, and keeps the build fully reproducible.
- **Sole chain/cryptographic dependency:** `@bsv/sdk` 2.1.4 — double-SHA256,
  transaction/script/header handling, and secp256k1 (the BSV curve) group
  operations for the optional trusted-operational mode.
- **License:** MIT (open reference implementation).

## D2 — Test execution

Library code is compiled to `dist/` by `tsc -b`. Test files are TypeScript and
run directly through `node:test` using Node's built-in type stripping; they
import each package through its workspace name (`@vaa/bsv`, …), which resolves to
the compiled `dist`. `npm run build` therefore precedes `npm test` in CI.
**Reason:** avoids a second compilation pass for tests and avoids naming any
build tool, while keeping the public package surface (what tests exercise) honest.

## D3 — Hashing site

All hashing goes through `@vaa/bsv`'s `doubleSha256`, implemented over the SDK's
`Hash.hash256` (verified to equal SHA-256∘SHA-256). `hashNode` is the only
internal-node hashing site. No package computes a hash directly. There is no
single-SHA-256 export.

## D4 — Script data envelope (pushdata in script; never OP_RETURN)

Data is carried in an `OP_FALSE OP_IF <pushdata> OP_ENDIF` envelope. Exact layout
of one envelope locking script:

```
OP_FALSE (0x00)  OP_IF (0x63)  <minimal pushdata of payload>  OP_ENDIF (0x68)
```

- The guard `OP_FALSE OP_IF … OP_ENDIF` means the pushed bytes are never executed
  and the output remains spendable; the data is recoverable by parsing.
- The payload is pushed with the minimal push opcode for its length: a direct
  push for ≤ 75 bytes, otherwise `OP_PUSHDATA1/2/4` with a little-endian length.
- **`OP_RETURN` (0x6a) is never emitted.** `recognise()` and the build path both
  assert no chunk is `OP_RETURN`.
- **Size limit:** one envelope payload is capped at `MAX_ENVELOPE_PAYLOAD =
  1_000_000` bytes; larger payloads return `EnvelopeOversize`. **Reason:** a
  generous but bounded limit; an accounting transaction with thousands of fields
  serialises well under it, and larger field sets are split across multiple
  envelope scripts.

## D5 — Carriage of an accounting transaction in ONE Bitcoin (BSV) transaction

`buildAccountingTx` returns an ordered `Script[]` for a single transaction:

1. `scripts[0]` — an envelope carrying the canonical serialisation of the whole
   ordered field set (so `parseAccountingTx` can recover every field).
2. `scripts[1]` and `scripts[2]` — the 32-byte field-tree root **held in two
   parts** (16 bytes each), each in its own envelope. **Reason:** the
   specification explicitly allows the root to be "held in parts" across the
   transaction's scripts; splitting it demonstrates that capability while keeping
   the field commitment fully recoverable (part1 ‖ part2 = root).

The root parts are framed with a fixed 4-byte magic + part index so recognition
is unambiguous; documented in `packages/evidence` source.

## D6 — Predetermined level (proof sharding)

- **API/config default:** `predeterminedLevel = 4`.
- **Studies:** choose `k = max(1, min(height − 1, floor(log2(N) / 2)))`, recorded
  in each study's output and in `docs/REPRODUCIBILITY.md`. **Reason:** placing the
  split near the middle of the tree balances the lower (per-item) shard against
  the shared upper shard, which is what the storage study measures.

## D6a — Shared upper portion is the proof-assistance labels

The proof store keeps each item's **lower** shard (leaf → level-k node) per item,
and stores the **proof-assistance labels** (the level-k node labels) **once per
root**. An item's **upper** shard (level-k node → root) is *derived on demand* as
a Merkle path within the labels, never stored per item. This is why "shared upper
portions are stored once per root": the labels are the shared upper structure,
and the per-item upper path is a function of them. The assisted
(selective-disclosure) flow does not use the upper path at all — it folds the
lower shard to a level-k node, checks it against the published label, and checks
the labels independently hash to the anchored root.

## D7 — secp256k1 naming

The curve is referred to only as "the BSV curve" / "Bitcoin's curve". No
altcoin or vendor attribution appears anywhere. The optional trusted-operational
homomorphic sum uses the SDK's curve point operations.

## D8 — Forbidden-token scan

`scripts/forbidden-scan.mjs` assembles its prohibited-token patterns from string
fragments at runtime, so the scanner source contains no literal prohibited token
and needs no self-exemption. The only exempted path is `REBUILD_SPEC.md`, the
originating build instruction, which necessarily enumerates the prohibited tokens
in order to prohibit them and is not part of the delivered system. Single
alphanumeric tokens are matched on word boundaries to avoid false positives in
unrelated identifiers and base64 integrity strings.

## D9 — Repository and remote

This clean VA2 rebuild lives in a new repository,
`prof-faustus/verifiable-accounting-bsv`, distinct from the original (contaminated)
`verifiable-accounting`. Part 0B's "remediate the existing repository" phase does
not apply: there is nothing to archive here, so the clean system is built from
scratch. Created private during the build; can be made public on release.
