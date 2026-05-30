# @vaa/bsv

Bitcoin (BSV) primitives and node access — the foundation every other package
builds on.

- `Hash`, `Txid`, `Script` — branded 32-byte / script values with display↔internal conversions.
- `doubleSha256`, `hashNode` — the only hashing sites in the project (via the BSV SDK).
- `parseTransaction` — a length-exact structural parse giving precise `TxTruncated` / `TxMalformed`.
- `BlockHeader`, `HeaderChain` — the append-only, self-validating header chain that is the verification trust root.
- `buildScriptDataEnvelope` / `recognise` — carry data as pushdata in script. **OP_RETURN is never used.**
- `OfflineNodeClient` (fixtures, used by CI) and `LiveNodeClient` (injected transport).

All untrusted-input paths return a typed `Result` and never throw.
