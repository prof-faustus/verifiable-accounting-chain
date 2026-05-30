# @vaa/simstore

The storage / retrieval efficiency study, measured from the real populated proof
store (no formula substituted for a measurement except the explicit baseline).

A fixed seed builds the population; the predetermined level is
`floor(log2 N / 2)`. The study reports the baseline full-proof bytes, the sharded
stored bytes (shared upper portions counted once), the duplicate bytes avoided,
the proof-assistance bytes per root, and the adversarial vs assisted retrieval
payloads. Timings are labelled *local*. The CI point writes
`vectors/study/storage_256.json`, which `reproduce` diffs.
