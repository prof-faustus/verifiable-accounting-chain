# @vaa/api

An enterprise service over the two patents.

- Operations: `anchor`, `prove`, `query` (the queried fragment only), `verify`.
- `verify` uses only the adversarial / proof-assistance path, terminates in the BSV header chain, and refuses any trusted-operational result.
- Boundary schema validation, pluggable authentication, per-caller rate limiting, and an append-only audit log that records metadata only — never record content, keys, or full proofs.
- Typed config validated at startup (fail fast); health and readiness endpoints; structured logging.

The request pipeline is exposed as `createApp(ctx).handle` for testing; `startServer` binds it to HTTP.
