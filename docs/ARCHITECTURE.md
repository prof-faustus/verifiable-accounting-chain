# Architecture

## What the system produces

Admissible, examinable **audit evidence**: the genuine accounting field(s) under
examination, plus proofs that each is committed to an accounting transaction's
field-tree root, mapped to its general-ledger position, recorded as a triple
entry, a link in a PKI-rooted provable chain, and anchored immutably on the
Bitcoin (BSV) chain — with everything else hidden. Verification terminates in a
validated BSV block-header chain (`@vaa/bsv` `HeaderChain`); no service component
is a trust root.

## The three pillars

**Pillar 1 — PKI root + general-ledger key hierarchy** (`@vaa/keys`,
EP3420669B1 + EP3259724B1 + US12256000B2 / Tartan 2021). A certified root key
anchors the entity's accounting structure. Each ledger node and field has a
deterministic sub-key derived by folding `child = parent + H(segment)` from the
root; public-side derivation equals private-side, so a verifier can confirm a
claimed node key from the published root alone.

**Pillar 2 — ECDH-linked, spend-linked, signed transaction chain** (`@vaa/chain`,
EP3259724B1 + US12375287B2). Each accounting transaction *spends* the previous
one (its input points at the predecessor's output) and carries a signature from a
key-series key derived deterministically from the predecessor and the PKI root.
Two reinforcing mechanisms — consensus-level spend ordering and a root-anchored
key chain — make reorder/insert/drop/tamper detectable. `verifyLinks` /
`verifyLinkProof` perform the checks; a `linkProof` binds one transaction into the
chain without revealing any other transaction's field values.

**Pillar 3 — per-field selective disclosure over the field tree** (`@vaa/merkle`,
`@vaa/proofstore`, WO2022100946 + WO2025119666). Each field is a Merkle leaf; the
proof is sharded with published proof-assistance labels so a query returns only
the portion for the field(s) requested.

## The unified layers

- **Field mapping** (`@vaa/ledgermap`, EP3420669B1): the chart of accounts is a
  tree; every field maps to a path and a deterministic key under the structure
  root; the versioned mapping root commits the structure for a period and travels
  on-chain (MAPPING-ROOT item).
- **Triple-entry** (`@vaa/tripleentry`): every event is a debit side, a credit
  side, and the single shared on-chain entry both reference; reconciliation is by
  construction and divergence/unmatched sides are detected.
- **Tax linkage** (`@vaa/tax`): tax fields are mapped fields; tax positions
  recompute from them; a tax bundle proves the declaration to the authority while
  revealing only the tax figures.
- **The auditor bundle** (`@vaa/bundle`): the tiny artifact tying it together —
  disclosed field(s) + Merkle path(s) + chain-link proof + inclusion proof.

## On-chain carriage (Part 5C-P3)

The field set and all commitments travel as **pushdata in script**, inside
`OP_FALSE OP_IF … OP_ENDIF` envelopes across the outputs of ONE Bitcoin (BSV)
transaction, as a TLV stream of items 0x01–0x08. **OP_RETURN is never used.** The
field leaf is the double-SHA256 of the exact FIELD-item body, so the on-chain
bytes are the hashed bytes.

## The fourteen packages

```
bsv ─┬─ keys ── chain ─┐
     ├─ merkle ─────────┼─ evidence ─┬─ ledgermap ── tax
     └─ proofstore ─────┘            ├─ tripleentry
                                     └─ bundle ── (api, cli)
                          studies: simstore, simstudy
```

- **bsv** — Hash/Txid/Script, doubleSha256/hashNode (only hashing sites),
  BlockHeader, HeaderChain (trust root), the pushdata envelope, node access, and
  the BSV-curve group-op wrappers.
- **keys** / **chain** — Pillars 1 and 2.
- **merkle** / **proofstore** — Pillar 3.
- **evidence** — the field model, the Part 5C-P3 TLV encoding, chained
  transactions, per-field disclosure, and the recomputation checks.
- **ledgermap** / **tripleentry** / **tax** / **bundle** — the unified layers.
- **api** / **cli** — the service and the `vaa` binary.
- **simstore** / **simstudy** — the mandatory studies.

## The trust root

`HeaderChain` is append-only and self-validating; `containsMerkleRoot` is the only
authority that a root is anchored. The proof store and any off-chain proof store
are availability/retrieval facilities only; the PKI root and the chain bind
identity and order but do not replace the header chain as the verification trust
root.
