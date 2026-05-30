# @vaa/tripleentry

Triple-entry recording: a debit side, a credit side, and the single shared
on-chain entry both sides reference.

- `buildTripleEntry` — a balanced event whose two sides reference the shared entry's outpoint.
- `verifyTripleEntry` — balance, shared reference, side-vs-shared agreement, and anchor in the header chain.
- `detectUnmatched` — flags a debit with no matching credit (and vice versa) across a set.
