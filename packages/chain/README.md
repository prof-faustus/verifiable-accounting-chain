# @vaa/chain

Pillar 2: the ECDH-linked, spend-linked, key-series-signed transaction chain
(EP3259724B1 + US12375287B2), rooted at the PKI key.

- `linkMessage` / `deriveHeadPub` / `deriveNextPub` — the deterministic link key series.
- `TransactionChain.append` / `verifyChain` / `linkProof`; `verifyLinks`, `verifyLinkProof`.
- Detects reorder / insert / drop / broken-spend / bad-signature; a link proof reveals no other transaction's field values.
- `commonSecret` — the ECDH common secret for confidential point-to-point delivery (not audit evidence).
