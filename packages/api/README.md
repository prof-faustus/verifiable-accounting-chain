# @vaa/api

An enterprise service over the three pillars.

- Operations: `anchor`, `prove`, `query` (the queried fragment only), `verify`,
  `chain/append`, `chain/verify`, `bundle/issue`, and `bundle/verify`.
- `verify` and `bundle/verify` use only the adversarial / proof-assistance path,
  terminate in the BSV header chain, and refuse any trusted-operational result.
- A single-period `ChainService` signs links from the PKI root; a JSON bundle
  codec lets an auditor verify a bundle independently.
- Boundary schema validation, pluggable authentication, per-caller rate limiting, and an append-only audit log that records metadata only — never record content, keys, or full proofs.
- Typed config validated at startup (fail fast); health and readiness endpoints; structured logging.

The request pipeline is exposed as `createApp(ctx).handle` for testing; `startServer` binds it to HTTP.
