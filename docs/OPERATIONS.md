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

Override by pointing the loader at a different config file or environment values
(see `@vaa/api` `loadConfig`). Never commit real credentials.

## Running the service

```
node packages/api/dist/server.js          # starts the HTTP service
```

Endpoints:

- `POST /anchor` — build the field tree and one-transaction script envelopes.
- `POST /prove` — Merkle proof for a data item.
- `POST /query` — the queried item's fragment only.
- `POST /verify` — audit-path verification, terminating in the header chain.
- `GET /healthz` — liveness.
- `GET /readyz` — readiness.

All requests are schema-validated, authenticated, rate-limited, and (for proof
responses) audit-logged with metadata only.

## Container

```
docker build -t verifiable-accounting-bsv .
docker run --rm verifiable-accounting-bsv selftest
```

The image entry point is the `vaa` CLI; override the command to run the service
(`node packages/api/dist/server.js`) or a study.

## Release process

1. Ensure `main` is green: `npm run lint && npm run build && npm test && npm run reproduce`.
2. Bump versions and update any release notes.
3. Tag with a semantic version: `git tag vX.Y.Z && git push origin vX.Y.Z`.
4. The release workflow re-verifies and publishes the GitHub release.

History is never rewritten; a tag marks an already-merged commit.
