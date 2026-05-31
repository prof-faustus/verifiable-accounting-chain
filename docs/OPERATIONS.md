# Operations

## Build

```
npm ci
npm run build
```

## Configuration

Configuration is a typed schema validated at startup; the service fails fast on
invalid config. Defaults are in `config/default.json`. Fields:

| Field | Meaning |
| --- | --- |
| `nodeEndpoint` | BSV node / header source (Teranode target). |
| `network` | `mainnet` or `testnet`. |
| `predeterminedLevel` | Proof-sharding split level (default 4). |
| `auth.scheme` | `apiKey` or `jwt`; the credential set is configured, not hard-coded. |
| `rateLimit.perMinute` | Per-caller request budget. |
| `logLevel` | Structured-log threshold. |
| `pkiRoot.provider` | The PKI root provider (Pillar 1): `seed` (deterministic from `PKI_ROOT_SEED`, test/dev) or `external` (a managed/HSM-held root supplied at runtime). |

Environment keys mirror the fields: `NODE_ENDPOINT`, `NETWORK`,
`PREDETERMINED_LEVEL`, `AUTH_SCHEME`, `AUTH_CREDENTIALS`, `RATE_LIMIT_PER_MINUTE`,
`LOG_LEVEL`, `PKI_ROOT_PROVIDER`, and `PKI_ROOT_SEED` (required when the provider
is `seed`). The service fails fast if any is missing or invalid. Override by
pointing the loader at a different config file or environment values (see
`@vaa/api` `loadConfig`). Never commit real credentials or a production root seed.

## Running the service

```
node packages/api/dist/server.js          # starts the HTTP service
```

Endpoints:

- `POST /anchor` — build the field tree and one-transaction script envelopes.
- `POST /prove` — Merkle proof for a data item.
- `POST /query` — the queried item's fragment only.
- `POST /verify` — audit-path verification, terminating in the header chain.
- `POST /chain/append` — append an accounting transaction as the next chain link (Pillar 2).
- `GET /chain/verify` — verify the whole chain (rooted at the PKI key).
- `POST /bundle/issue` — issue a tiny auditor proof bundle for requested fields.
- `POST /bundle/verify` — verify a proof bundle (inclusion + chain + anchor), terminating in the header chain.
- `GET /healthz` / `GET /readyz` — liveness / readiness.

`verify` and `bundle/verify` use only the adversarial path and refuse any
trusted-operational result. The `chain/*` operations are served by a single-period
`ChainService` that signs links from the configured PKI root. All requests are
schema-validated, authenticated, rate-limited, and (for proof/bundle responses)
audit-logged with metadata only — never field values.

## Container

```
docker build -t verifiable-accounting-chain .
docker run --rm verifiable-accounting-chain selftest
```

The image entry point is the `vaa` CLI; override the command to run the service
(`node packages/api/dist/server.js`) or a study.

## Release process

1. Ensure `main` is green: `npm run lint && npm run build && npm test && npm run reproduce`.
2. Bump versions and update any release notes.
3. Tag with a semantic version: `git tag vX.Y.Z && git push origin vX.Y.Z`.
4. The release workflow re-verifies and publishes the GitHub release.

History is never rewritten; a tag marks an already-merged commit.
