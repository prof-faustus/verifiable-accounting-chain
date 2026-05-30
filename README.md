# verifiable-accounting-chain

A BSV-native audit-evidence platform in which a **PKI root** anchors a hierarchy
of keys, an **ECDH-derived, spend-linked, signed transaction chain** links every
accounting transaction into one provable chain, and **per-field selective
disclosure** lets an auditor, tax authority, or regulator be handed a tiny proof
bundle that reveals only the fields they ask for while hiding everything else.

This is accounting/audit/tax-evidence infrastructure — not a cryptography
project. The evidence mechanism is **selective disclosure**: the system produces
the genuine accounting field(s) under examination together with proofs that each
is committed, mapped, chained, and anchored on the Bitcoin (BSV) chain. There is
**no** hidden-value cryptography — no commitment scheme, zero-knowledge proof, or
range proof — because those prove only a relationship among concealed numbers,
which is not audit evidence. Bitcoin (BSV) — the original Bitcoin protocol — is
the entire technical universe; verification terminates in a validated BSV block
header chain.

## The three pillars

1. **PKI root + general-ledger key hierarchy** (`@vaa/keys`). A single certified
   root key anchors the entity's accounting structure; every ledger node and
   field has a deterministic sub-key derived under the root (public-side
   derivation matches private-side).
2. **ECDH-linked transaction chain** (`@vaa/chain`). Each accounting transaction
   *spends* the previous one and carries a signature from a key-series key that is
   derived deterministically from its predecessor and the PKI root, so reordering,
   inserting, or dropping a transaction is detectable.
3. **Per-field selective disclosure over the field tree** (`@vaa/merkle`,
   `@vaa/proofstore`, `@vaa/evidence`). Each field of an accounting transaction is
   a leaf of a Merkle field tree; the proof is sharded so a query returns only the
   portion needed for the field(s) requested.

On top of the pillars the platform is **mapped** (`@vaa/ledgermap` — every field
has a ledger path and key under the structure root), **triple-entry**
(`@vaa/tripleentry` — debit, credit, and the shared on-chain entry both sides
reference), and **tax-linked** (`@vaa/tax` — tax positions recompute from mapped
tax fields). `@vaa/bundle` assembles and verifies the tiny auditor bundle.

## The worked auditor scenario

An auditor asks a narrow question — "show me the VAT total for the period and
prove it matches the on-chain root." The holder produces a small bundle: the
disclosed field(s), the Merkle path proving each belongs to the accounting
transaction's committed field-tree root, the chain evidence binding the
transaction into the PKI-rooted provable chain, and the inclusion proof anchoring
it on Bitcoin (BSV). The auditor verifies independently and learns the figure is
genuine, committed, mapped, chained, and anchored — and **nothing** about any
other field or record.

**Honest boundary:** this proves the produced field is the genuine committed,
anchored field in the provable chain and that stated arithmetic holds over
disclosed fields; it does **not** establish that a faithfully recorded figure
reflects external reality (a record committed falsely at origin is not detected).

## Packages

| Package | Role |
| --- | --- |
| `@vaa/bsv` | BSV primitives + the secp256k1 (BSV-curve) group-op wrappers. |
| `@vaa/keys` | Pillar 1: PKI root + general-ledger key hierarchy. |
| `@vaa/chain` | Pillar 2: the ECDH-linked, spend-linked, signed transaction chain. |
| `@vaa/merkle` | Field-tree Merkle primitives. |
| `@vaa/proofstore` | Pillar 3: selective verification / proof-sharding. |
| `@vaa/evidence` | Accounting records → field tree (Part 5C-P3 TLV carriage), checks. |
| `@vaa/ledgermap` | The field map: structure, field→path→key, mapping root, extraction. |
| `@vaa/tripleentry` | Triple-entry recording and reconciliation. |
| `@vaa/tax` | Tax fields as mapped fields, recomputation, the tax bundle. |
| `@vaa/bundle` | The tiny auditor proof bundle (issue + verify). |
| `@vaa/api` | Service: anchor/prove/query/verify + chain + bundle operations. |
| `@vaa/cli` | `vaa` binary: the operations above + selftest + reproduce. |
| `@vaa/simstore` | Storage / retrieval + bundle-size study. |
| `@vaa/simstudy` | Assurance study with the unified fault matrix. |

## Install, build, verify

```
npm ci
npm run build
npm run lint        # format check + forbidden-token scan
npm test            # full test suite
node packages/cli/dist/index.js selftest    # every layer, pass/fail
node packages/cli/dist/index.js reproduce   # regenerate + diff all vectors
npm run study:store
npm run study:assurance
```

Absolute timings printed by the studies are labelled *local* and must be re-run
on the hardware named in [docs/REPRODUCIBILITY.md](docs/REPRODUCIBILITY.md).

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — the three pillars, the unified layers, the trust root.
- [Decisions](docs/DECISIONS.md) — stack, the Part 5C-P3 TLV encoding, the link relation, open-choice resolutions.
- [Security](docs/SECURITY.md) — the trust model: header chain, PKI root + chain, selective disclosure, honest boundary.
- [Reproducibility](docs/REPRODUCIBILITY.md), [Operations](docs/OPERATIONS.md).
