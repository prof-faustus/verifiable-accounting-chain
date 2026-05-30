# @vaa/merkle

The Merkle Proof Entity (WO 2022/100946). Builds the **intra-transaction field
tree** — each leaf is a field of one accounting transaction — and proves a leaf
belongs to the committed root.

- `buildTree` / `computeRoot` — odd levels pair the last node with itself.
- `merkleProof` / `reconstructRoot` / `verifyProof`.
- `proveAgainstChain` — a proof is valid only when its root sits in a validated BSV header (`@vaa/bsv` `HeaderChain`).

Verification never throws on adversarial input; a bad proof simply does not match.
