# Decisions

This is the living record of engineering decisions, including every point the
specification left open and how it was resolved.

## D1 — Repository and naming

The system is built in a NEW repository, `verifiable-accounting-chain`, separate
from the Paper 1 (triple-entry-evidence) and Paper 2 (verifiable-accounting-bsv)
repositories. Nothing is archived from elsewhere; the shared field-tree /
selective-disclosure core is re-implemented here and the PKI key hierarchy and
the ECDH-linked chain are added on top. **Reason:** Part 0R requires a clean,
from-scratch build in its own repository.

## D2 — Stack and toolchain

- TypeScript 5.7 strict (`strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `noImplicitOverride`, `noUnusedLocals/Parameters`),
  Node.js 24 LTS, ESM, NodeNext resolution.
- npm workspaces + `tsc -b` project references. No third-party task runner,
  bundler, or monorepo orchestrator; nothing in the repo names a build tool.
- Supporting roles (test runner `node:test`, arg parser `node:util`, HTTP
  `node:http`, timing `node:perf_hooks`, logger/schema/RNG/property helpers) are
  Node built-ins or in-tree, to keep the lockfile (forbidden-token scanned) tiny.
- Sole chain/cryptographic dependency: `@bsv/sdk` 2.1.4 — double-SHA256,
  transaction/script/header handling, and secp256k1 (the BSV curve) group
  operations used by the PKI hierarchy and the ECDH chain. License MIT.

## D3 — No tool identity (Part 0.4)

Nothing in the project, its comments, documentation, commit messages, or
dependencies names any build agent, assistant, or tooling provider. The
forbidden-token scanner additionally flags a small set of assistant/provider
identity tokens (assembled from fragments so the scanner itself stays clean).

## D4 — The BSV curve wrappers live in `@vaa/bsv`

All secp256k1 group operations (point add/multiply, generator G, order n, scalar
reduction mod n, compressed point encode/decode) are wrapped in `@vaa/bsv` over
the SDK, so no other package performs curve math directly. ECDSA sign/verify
(low-S) in `@vaa/keys` uses the SDK's signature primitives over the same curve.
The curve is referred to only as "the BSV curve" / "Bitcoin's curve" — no
altcoin/vendor attribution anywhere.

## D5 — Deterministic derivation and the link relation

- Child derivation (EP3259724B1): `gv = doubleSha256(segment) mod n`,
  `childPriv = parentPriv + gv`, `childPub = parentPub + gv·G`; public-side and
  private-side derivation match. `reduce(hash)` interprets the 32 internal bytes
  big-endian mod n; the negligible modulo bias is acceptable because the value is
  a derivation offset, not a nonce (documented in `@vaa/bsv` `reduceScalar`).
- Link key series (Pillar 2): `M_i = doubleSha256(T_{i-1} ‖ R_{i-1} ‖ R_i)`,
  `GV_i = reduce(M_i)`, `linkPriv_i = linkPriv_{i-1} + GV_i`; the head is
  `rootPriv + reduce(genesisMsg)`, binding every link key to the PKI root and to
  every preceding transaction. Each link additionally records a spend-link
  (`prevOutpoint.txid == predecessor txid`) and a per-link signature over the
  field-root indication, so reorder/insert/drop/broken-spend/bad-signature are
  all detected.

## D6 — Hashing site and the field leaf (Part 5C-P3)

All hashing goes through `@vaa/bsv` `doubleSha256` (the only hashing site). The
**field leaf is the double-SHA256 of the exact on-chain FIELD-item body**
(`leafIndex ‖ tagLen ‖ tag ‖ valueLen ‖ value`), so on-chain bytes equal the
hashed bytes and each field is bound to its leaf index.

## D7 — Part 5C-P3 TLV on-chain encoding (pushdata; never OP_RETURN)

Data is carried in `OP_FALSE OP_IF <minimal pushdata> OP_ENDIF` envelopes across
the outputs of ONE Bitcoin (BSV) transaction. The payload is a TLV stream of
items `type(1) | length(uint32 BE) | body` for the eight item types 0x01–0x08
(header, field, root-part, assist-label, chain-link, mapping-root, triple-ref,
pki-attest). All multi-byte integers are big-endian; 32-byte hashes/points are
internal order; points are 33-byte compressed. **OP_RETURN (0x6a) is never
emitted**; a negative test scans every produced script. To exercise the
multiple-output capability, the packer chunks the stream at
`EVIDENCE_ENVELOPE_CHUNK = 10_000` bytes per envelope, so a large field set spans
several outputs of the one transaction.

## D8 — The proof store sharing model (carried from the shared core)

The lower (per-item) shard is stored per item; the proof-assistance labels (the
level-k node labels) are stored once per root, and each item's upper shard is
*derived* from them. The assisted (selective-disclosure) flow folds the lower
shard to a level-k node, checks it against the published label, and checks the
labels independently hash to the anchored root. Predetermined-level default 4;
the studies choose `k = max(1, min(height − 1, floor(log2(N)/2)))`.

## D9 — The auditor bundle and its anchor

`@vaa/bundle` carries the disclosed field(s) + Merkle path(s) + the chain-link
proof + the committing transaction's inclusion proof. `verifyBundle` checks
selective disclosure (each field folds to the committed root), ties the chain
link and inclusion to that root, checks the inclusion folds to a block root in
the validated header chain (anchor), verifies the chain-link proof, and verifies
any PKI attestation. The chain-link proof carries only the predecessor's txid and
committed ROOT (a public commitment) and the outpoint — never another
transaction's field VALUES.

## D10 — Mapping, triple-entry, and tax

- ledgermap: a field's key is `derivePathPub(rootPub, [...accountPath,
  "field:"+tag])`; `mapField` requires the tag be in the account node's
  `fieldTags`; the mapping root is `doubleSha256(serializeStructure)` and is
  carried on-chain via the MAPPING-ROOT item so a verifier confirms the structure.
- tripleentry: a balanced event yields debit/credit sides that both reference the
  shared on-chain entry's outpoint; `verifyTripleEntry` checks balance, shared
  reference, side-vs-shared agreement (against the shared tx's `event.amount`
  field), and anchor.
- tax: tax fields (`tax.outputAmount`, `tax.inputAmount`, `tax.vatPayable`, …) are
  mapped fields; `recomputeVat` sums them; `verifyTaxBundle` layers inclusion +
  chain + anchor (via `@vaa/bundle`) with mapping and recompute. Permitted VAT
  rates are basis points in a configured set.

## D11 — Test doubles for the anchor

Where a test needs the committing transaction anchored, it uses a SYNTHETIC block
header (an easy compact target so its hash meets target without mining) carrying
the relevant merkle root, or a single-transaction block whose merkle root is the
txid. These are clearly-labelled test doubles for the header-chain interface —
not presented as genuine BSV block data. The genuine-block anchoring path is
covered by the merkle e2e test against real Bitcoin (BSV) block 181. No chain
fixture is fabricated.

## D12 — Forbidden-token scan

`scripts/forbidden-scan.mjs` assembles its prohibited-token patterns from string
fragments at runtime, so the scanner source contains no literal prohibited token.
It scans source, docs, config, the lockfile, filenames, and commit messages.
Single alphanumeric tokens are matched on word boundaries to avoid false
positives in unrelated identifiers and base64 integrity strings. The Paper 3
specification file lives outside the repository, so no in-repo file is exempt.
