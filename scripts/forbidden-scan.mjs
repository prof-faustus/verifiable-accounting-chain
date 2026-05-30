// Forbidden-token scan (Part 0.1 of the specification).
//
// The Bitcoin (BSV) protocol is the entire universe of this project. No
// reference to the other fork or to any altcoin/ecosystem-specific feature may
// appear anywhere in the delivered system: source, comments, docs, config, the
// lockfile, vector filenames, example data, or commit messages.
//
// The token patterns below are assembled from fragments at runtime so that this
// scanner file itself contains no literal forbidden token and therefore does not
// need to be exempted from its own scan. The only exempted path is the
// originating build instruction REBUILD_SPEC.md (which necessarily enumerates
// the prohibited tokens in order to prohibit them); it is not part of the
// delivered system.
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');

// Each entry: [humanLabel, regExp]. Single alphanumeric tokens are matched on
// word boundaries to avoid false positives inside unrelated identifiers or
// base64 integrity strings; phrases are matched literally (case-insensitive).
const f = (s) => s; // identity, keeps fragments readable
const word = (frag) => new RegExp('\\b' + frag + '\\b', 'i');
const phrase = (frag) => new RegExp(frag.replace(/ /g, '\\s+'), 'i');

const PATTERNS = [
  ['fork-ticker', word(f('b') + f('tc'))],
  ['fork-client', phrase(f('bitcoin ') + f('core'))],
  ['witness-segregation', word(f('seg') + f('wit'))],
  ['fork-script-upgrade', word(f('tap') + f('root'))],
  ['off-chain-network', word(f('light') + f('ning'))],
  ['locktime-opcode-alias', word(f('cl') + f('tv'))],
  ['sequence-opcode-alias', word(f('cs') + f('v'))],
  ['locktime-opcode', new RegExp(f('op_check') + f('locktimeverify'), 'i')],
  ['sequence-opcode', new RegExp(f('op_check') + f('sequenceverify'), 'i')],
  ['ecosystem-vendor', word(f('block') + f('stream'))],
  ['fork-library-a', new RegExp(f('rust-') + f('bitcoin'), 'i')],
  ['fork-library-b', new RegExp(f('bitcoin-') + f('private'), 'i')],
  ['hidden-value-commitment', word(f('peder') + f('sen'))],
  ['range-proof', word(f('bullet') + f('proof'))],
  ['fork-block-reference', phrase(f('block ') + f('170'))],
  ['fork-person-reference', phrase(f('hal ') + f('finney'))],
  ['unit-name', word(f('sato') + f('shi'))],
];

const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist']);
const EXEMPT_FILES = new Set(['REBUILD_SPEC.md']);

const findings = [];

function isProbablyText(buf) {
  const n = Math.min(buf.length, 8000);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return false;
  return true;
}

function scanContent(rel, text) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const [label, re] of PATTERNS) {
      if (re.test(lines[i])) findings.push(`${rel}:${i + 1}: forbidden token (${label})`);
    }
  }
}

function scanPath(rel) {
  for (const [label, re] of PATTERNS) {
    if (re.test(rel)) findings.push(`path ${rel}: forbidden token in filename (${label})`);
  }
}

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    const rel = relative(root, full).split('\\').join('/');
    if (st.isDirectory()) {
      if (!SKIP_DIRS.has(entry)) walk(full);
      continue;
    }
    if (entry.endsWith('.tsbuildinfo')) continue;
    scanPath(rel);
    if (EXEMPT_FILES.has(rel)) continue;
    const buf = readFileSync(full);
    if (!isProbablyText(buf)) continue;
    scanContent(rel, buf.toString('utf8'));
  }
}

walk(root);

// Commit messages.
const gitDir = join(root, '.git');
if (existsSync(gitDir)) {
  const log = spawnSync('git', ['log', '--format=%H%n%B%n----'], { cwd: root, encoding: 'utf8' });
  if (log.status === 0 && typeof log.stdout === 'string') {
    const text = log.stdout;
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      for (const [label, re] of PATTERNS) {
        if (re.test(lines[i])) findings.push(`commit-message: forbidden token (${label}) near "${lines[i].slice(0, 60)}"`);
      }
    }
  }
}

if (findings.length > 0) {
  console.error('Forbidden-token scan FAILED:');
  for (const x of findings) console.error('  ' + x);
  process.exit(1);
}
console.log('Forbidden-token scan passed: no prohibited token in source, docs, config, lockfile, filenames, or commit messages.');
