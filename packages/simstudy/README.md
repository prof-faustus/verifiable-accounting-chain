# @vaa/simstudy

The synthetic-population assurance study. A fixed seed builds an AR roll-forward
population whose clean version balances exactly; the records are anchored as
Bitcoin (BSV) data items.

It measures inclusion proof generation/verification (timings *local*),
selective-disclosure retrieval, and the AR roll-forward by recomputation. Fault
injection covers seven classes (tampered leaf, wrong index, wrong root, missing
fragment, altered/omitted/duplicated record): every in-scope fault is detected,
with zero false positives on the clean population. The honest boundary — a record
committed **falsely at origin** is **not** detected — is recorded explicitly. The
CI point writes `vectors/study/simstudy_240.json`, which `reproduce` diffs.
