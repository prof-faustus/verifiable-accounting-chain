# @vaa/ledgermap

The field map (EP3420669B1): the chart of accounts as a key hierarchy.

- `validateStructure` / `enumerateFields` — the GL structure (ledger → account → sub-account → field).
- `fieldKey` / `mapField` / `verifyFieldUnderRoot` — field → path → deterministic key under the structure root.
- `mappingRoot` / `verifyMappingRoot` — the versioned commitment to the structure in force (carried on-chain).
- `extractField` — a mapped field's data across a plurality of transactions, revealing only that field.
