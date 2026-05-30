# Contributing

## Ground rules

1. **Bitcoin (BSV) only.** No reference to, dependency on, or feature of the other
   fork or any altcoin/ecosystem-specific construction may appear anywhere — in
   source, comments, docs, config, the lockfile, vector filenames, example data,
   or commit messages. `npm run scan` enforces this and runs in CI.
2. **Audit evidence, not cryptography.** Selective disclosure is the only
   evidence mechanism. No commitment scheme, zero-knowledge proof, range proof,
   or other hidden-value construction is permitted.
3. **No `OP_RETURN`, ever.** Data is carried as pushdata in script.
4. **No fabricated values.** No number, benchmark, or chain fixture is invented.
   `npm run reproduce` regenerates every deterministic value. Any BSV block data
   used in tests is genuine and carries a `source` field; if genuine data cannot
   be obtained in the build environment, the dependent test is marked pending and
   names the exact fields it needs — never filled with invented bytes.
5. **No stubs.** Every function is implemented in full; every enumerated test is
   written.

## Local workflow

```
npm ci
npm run build
npm run lint     # format check + forbidden-token scan
npm test
npm run reproduce
```

## Style

- Strict TypeScript; the compiler is the type-check and lint gate, and warnings
  are errors. Keep the build clean.
- Typed errors only: every package exports a typed error union. No thrown strings,
  no bare `Error`, no unhandled rejection. Adversarial input must never throw.
- Two spaces, LF line endings, final newline, no trailing whitespace
  (`npm run format:check`).
- Refer to supporting tools by their role, not a brand name.

## Commits and releases

Conventional, descriptive commit messages. Releases are semantic version tags;
history is never rewritten.
