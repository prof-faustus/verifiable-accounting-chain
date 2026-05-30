// A tiny deterministic PRNG (splitmix32) for property tests — no dependency, so
// the lockfile stays minimal and runs are reproducible.
export function rng(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = (Math.imul(z ^ (z >>> 16), 0x21f0aaad)) >>> 0;
    z = (Math.imul(z ^ (z >>> 15), 0x735a2d97)) >>> 0;
    return ((z ^ (z >>> 15)) >>> 0) / 0x100000000;
  };
}

export function randomLeaves(seed, count) {
  // Import lazily so this module stays usable before the build in tooling.
  const next = rng(seed);
  const out = [];
  for (let i = 0; i < count; i++) {
    const b = new Uint8Array(8);
    for (let j = 0; j < 8; j++) b[j] = Math.floor(next() * 256) & 0xff;
    out.push(b);
  }
  return out;
}
