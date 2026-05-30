# @vaa/bundle

The tiny auditor PROOF BUNDLE.

- `issueBundle` — disclosed field(s) + each field's Merkle path + the chain-link proof + the committing tx's inclusion proof; nothing about any other field.
- `verifyBundle` — selective disclosure (each field folds to the committed root) + anchor (validated header chain) + chain + optional PKI attestation.
- Bundle size is O(disclosed fields + log fieldCount), independent of the transaction's total field count.
