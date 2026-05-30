# verifiable-accounting-bsv

A BSV-native, enterprise-grade system for producing **admissible, examinable
audit evidence** about real accounting records.

This is accounting and audit-evidence infrastructure — for financial audit, tax,
and assurance — not a cryptography project. The evidence mechanism is
**selective disclosure**: when an assertion is examined, the system discloses the
actual accounting records needed for that specific assertion (and the proof that
they are genuine and on-chain) while revealing nothing about any other record.

Bitcoin (BSV) — the original Bitcoin protocol — is the entire technical universe
of this project. Verification terminates in a validated BSV block-header chain.

## Core data model

An accounting transaction (an invoice, a journal entry, a ledger posting, a
reconciliation, a statement line set) has a set of standard **fields**. Each
field is a **leaf** in a Merkle tree built over that one accounting transaction's
fields — an *intra-transaction* tree, not a tree of transaction identifiers. The
Merkle **root** commits the whole field set and is carried inside a single
Bitcoin (BSV) transaction as **pushdata in script** (never `OP_RETURN`).

Because each field is a leaf, the holder can disclose exactly the field(s) an
auditor or tax authority needs and provide the Merkle path proving that field
belongs to the committed root — revealing nothing about the other fields.

There is **no** commitment scheme, zero-knowledge proof, range proof, or any
hidden-value construction anywhere in this system. Those
prove a relationship among concealed numbers; they are not audit evidence,
because the genuine record is never produced. Selective disclosure produces the
genuine record. That is the entire mechanism.

## Two assurance modes

- **Adversarial audit mode (default, the only mode yielding independent audit
  evidence):** ordinary Merkle reconstruction against public node labels / the
  on-chain root, terminating in the BSV header chain.
- **Trusted-operational mode (off by default, explicit opt-in only):** a
  homomorphic compression of the proof-assistance data. **It is not adversarially
  sound and is never accepted by the audit verification path.** See
  [docs/SECURITY.md](docs/SECURITY.md).

## Packages

| Package | Role |
| --- | --- |
| `@vaa/bsv` | BSV primitives: hashes, transactions, headers, the validated header chain, pushdata script envelopes, node access. |
| `@vaa/merkle` | Merkle Proof Entity: field-tree construction, proofs, verification against the header chain. |
| `@vaa/proofstore` | Selective Verification: index keys, non-overlapping proof shards, public proof-assistance, the availability-only proof store. |
| `@vaa/evidence` | Accounting records → BSV field tree: schemas, canonical serialisation, per-field selective disclosure, recomputation checks. |
| `@vaa/api` | Enterprise service: anchor, prove, query, audit-path verify. |
| `@vaa/cli` | Command-line binary `vaa`: anchor, prove, verify, query, selftest, reproduce. |
| `@vaa/simstore` | Storage / retrieval efficiency study. |
| `@vaa/simstudy` | Synthetic-population assurance study with fault injection. |

## Install and build

```
npm ci
npm run build
```

## Quickstart

```
# exercise every layer end to end and report pass/fail per layer
node packages/cli/dist/index.js selftest

# regenerate every deterministic vector and reported figure, then diff
node packages/cli/dist/index.js reproduce
```

## Verify, test, reproduce, studies

```
npm run lint        # format check + forbidden-token scan
npm test            # full test suite
npm run reproduce   # regenerate + diff all deterministic vectors
npm run study:store        # storage / retrieval study (CI point)
npm run study:assurance    # assurance study (CI point)
```

Absolute timings printed by the studies are labelled *local* and must be re-run
on the hardware named in [docs/REPRODUCIBILITY.md](docs/REPRODUCIBILITY.md).

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — the two layers, their patent origins, the eight packages, the trust root.
- [Decisions](docs/DECISIONS.md) — stack, the script pushdata-envelope convention, the predetermined-level choice.
- [Reproducibility](docs/REPRODUCIBILITY.md) — exact commands; CI vs full-run; the local-timing note.
- [Operations](docs/OPERATIONS.md) — deploying and running the service.
- [Security](docs/SECURITY.md) — the trust model.
