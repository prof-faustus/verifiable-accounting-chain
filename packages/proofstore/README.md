# @vaa/proofstore

Selective Verification (WO 2025/119666). Shards a proof into non-overlapping
portions and serves only the portion a query needs.

- `IndexKey` — the canonical, collision-free addressing schema (claims 5–6).
- `shardProof` / `reassemble` — lower (per-item) and upper portions (claims 2–3).
- `computeProofAssistance` / `labelsHashToRoot` — public node labels (claim 8), stored once per root.
- `ProofStore` — `anchor` / `query` / `verify` (adversarial audit path) / `verifyWithAssistance` (**selective disclosure**).
- `trusted` — the optional homomorphic BSV-curve sum (claims 9–11): off by default, **never accepted by the audit path**.

The store is availability-only; it is never a trust root.
