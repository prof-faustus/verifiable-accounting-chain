# Security and trust model

## Trust root

Every verification terminates in **public Bitcoin (BSV) data**: a proof is valid
only when its Merkle root is carried by a header in a validated BSV header chain
(`@vaa/bsv` `HeaderChain`). The chain is append-only and self-validating — each
header must link to the current tip's hash and meet its proof-of-work target.
**No service component is ever a trust root.**

## The proof store is availability-only

The proof store (`@vaa/proofstore`) stores and serves proof shards and public
proof-assistance labels. It holds no authority. A misbehaving store can only:

- **withhold** a fragment — the query fails (`KeyNotFound`) or reassembly fails
  (`ShardNonContiguous`); verification does not succeed;
- **return a wrong fragment** — reconstruction yields a root that does not match
  the anchored root (`RootMismatch`), or the assisted node does not match the
  published label (`AssistanceMismatch`); verification does not succeed.

In every case a store fault surfaces as a verification **failure**, never as a
false acceptance. The store cannot forge acceptance because it cannot produce a
fragment that folds to the on-chain root without the genuine data.

## Selective disclosure is the privacy mechanism

Privacy comes from **proof-sharding plus per-field leaves**, not from hiding
values. When field *i* is examined, only `field_i`, its Merkle path (the lower
shard), and the public proof-assistance are disclosed. The verifier folds the
lower shard to a node and checks it against the published level-*k* label, then
checks the labels independently hash to the anchored root. No other field value
is ever transmitted or needed. There is **no** commitment scheme,
zero-knowledge proof, range proof, or other hidden-value construction anywhere
in the system — by design, because such constructions
prove only a relationship among concealed numbers and are not audit evidence.

## Trusted-operational mode is not adversarially sound

The optional homomorphic compression of the proof-assistance node data
(`@vaa/proofstore` `trusted`, claims 9–11) is realised as a sum of BSV-curve
points. It is **off by default**, exposed only behind an explicit
`trustedOperational` selection, and **never accepted by the audit path**:
`ProofStore.verify(…, "trustedOperational")` returns
`TrustedOperationalNotAcceptedForAudit`, and the API `verify` operation refuses
any result derived from it. It is documented here as easier to manipulate than
adversarial Merkle reconstruction and must not be relied upon for audit evidence.

## Honest boundary

A record committed **falsely at origin** — internally consistent but untrue — is
**not** detected by this system. Inclusion proofs, selective disclosure, and
recomputation establish that the produced records are the genuine committed,
anchored records and that the stated arithmetic holds over them; they do not
establish that a faithfully recorded figure reflects reality. The assurance study
asserts this boundary explicitly (it is a stated limit, not a defect).

## Logging

Logging is structured. No underlying record content, key material, or full proof
is logged at info level. The audit channel records proof responses with metadata
only: timestamp, caller, query key, returned fragment identifier, and the
verification outcome — never the record content.
