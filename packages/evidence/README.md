# @vaa/evidence

Turns real accounting records into a Bitcoin (BSV) field tree and checks
assertions by recomputation over disclosed records.

- Typed schemas (invoice, payment, ledger entry, reconciliation item) in bigint minor units.
- Canonical, versioned, deterministic serialisation — the anchored data item.
- `fieldLeaf` / `fieldTreeRoot` / `buildAccountingTx` — the field set and its commitment carried as pushdata in **one** transaction (never OP_RETURN; root held in parts).
- `discloseField` / `verifyDisclosedField` — reveal exactly one field plus its Merkle path.
- Recomputation checks: invoice total, AR roll-forward, debit/credit equality, bank reconciliation, VAT.

No commitment scheme, zero-knowledge, or range proof anywhere.
