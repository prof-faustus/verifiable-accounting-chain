# @vaa/keys

Pillar 1: the PKI root and the deterministic general-ledger key hierarchy
(EP3420669B1, EP3259724B1) on the Bitcoin (BSV) curve.

- `derivePrivChild` / `derivePubChild` — child = parent + H(segment); public-side derivation matches private-side.
- `rootFromSeed` / `derivePathPub` / `derivePathPriv` / `verifyNodeUnderRoot` — the root-anchored hierarchy.
- `sign` / `verify` / `attestStructure` — ECDSA (low-S) over the BSV curve; the root is a certified, signed key.
