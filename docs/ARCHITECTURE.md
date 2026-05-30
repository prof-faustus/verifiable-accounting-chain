# Architecture

## What the system produces

Admissible, examinable **audit evidence** about real accounting records: the
genuine field(s) under examination, plus a proof that each is a committed part of
an accounting transaction whose commitment is anchored, immutably and verifiably,
on the Bitcoin (BSV) chain.

## The two layers (and their patent origins)

**Layer A — provable presence / inclusion (Merkle Proof Entity, WO 2022/100946).**
Each field of an accounting transaction is a leaf; a Merkle path proves a given
field-leaf belongs to that accounting transaction's committed root. The committing
Bitcoin (BSV) transaction's own inclusion in a block is provable by the same
primitive, so the field commitments inherit on-chain timestamping. **Verification
terminates in the validated BSV header chain** (`@vaa/bsv` `HeaderChain`): a proof
is valid only when its root is carried by a header in that chain.

**Layer B — selective disclosure / proof-sharding (Selective Verification,
WO 2025/119666).** The field-proof is split into non-overlapping **portions**
(shards) with published **proof-assistance** node labels, addressable so a query
returns only the portion needed for the field(s) requested. The holder discloses
exactly the field under examination and the lower shard; the verifier completes
the check from that shard plus public data, learning nothing about any other
field or record. This is selective disclosure.

The optional homomorphic compression of the proof-assistance data (claims 9–11)
is the **trusted-operational** mode: off by default, never accepted by the audit
path, documented as not adversarially sound.

## The intra-transaction field tree (core data model)

```
accounting transaction
   ├── field 0  ── leaf0 = doubleSha256( canonical(tag0, value0) )
   ├── field 1  ── leaf1 = doubleSha256( canonical(tag1, value1) )
   ├── …                       │
   └── field n  ── leafn       │  Merkle tree over the fields
                               ▼
                         field-tree ROOT  ── carried as pushdata in script,
                                             in ONE Bitcoin (BSV) transaction
                                             (never OP_RETURN; root may be held
                                              in parts across the scripts)
```

Selective disclosure of field *i* = `{ field_i, merklePath(i), root }`. The
auditor recomputes `leaf_i` from the disclosed field, folds the path, and checks
it reconstructs the anchored root. No other field value is needed or revealed.

## The eight packages

```
bsv  ──►  merkle  ──►  proofstore  ──►  evidence  ──►  api  ──►  cli
  │          │             │              │
  └──────────┴─────────────┴──────────────┴──────►  simstore, simstudy
```

- **bsv** — `Hash`, `doubleSha256`/`hashNode` (the only hashing sites), `Txid`,
  `Script`, `Transaction`, `BlockHeader`, `HeaderChain` (the trust root),
  `ScriptDataEnvelope` (pushdata; never `OP_RETURN`), `NodeClient`
  (offline fixtures for CI; live Teranode-target client).
- **merkle** — `buildTree`/`computeRoot`, `merkleProof`, `reconstructRoot`/
  `verifyProof`, `proveAgainstChain` (anchors verification in the header chain).
- **proofstore** — `IndexKey`, `shardProof`/`reassemble`, `ProofAssistance`,
  `ProofStore` (`anchor`/`query`/`verify`/`verifyWithAssistance`), the optional
  trusted-operational sum, retrieval-payload byte counters.
- **evidence** — accounting object schemas, canonical versioned serialisation,
  the field tree + per-field disclosure, index-map population, recomputation
  checks (invoice total, AR roll-forward, debit/credit equality, bank
  reconciliation, VAT).
- **api** — config/auth/rate-limit/audit-log/schemas/handlers/server; the
  `verify` handler uses only the adversarial path and terminates in the header
  chain.
- **cli** — `anchor`, `prove`, `verify`, `query`, `selftest`, `reproduce`.
- **simstore** / **simstudy** — the two mandatory studies.

## The trust root

`@vaa/bsv`'s `HeaderChain` is append-only and self-validating: every added header
must link to the current tip and meet its target. `containsMerkleRoot` is the
only authority that a root is anchored. Nothing outside the validated chain is
trusted; the proof store is an availability and retrieval service only.
