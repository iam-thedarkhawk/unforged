// Regenerates the demo attack from demo/site, deterministically: run it twice, get the same
// bytes. It produces three things under the demo dir:
//   - attacker/evil.js      the payload, with demo/config.json baked into the template
//   - tampered/<chunk>       the genuine chunk with the payload appended
//   - clone/                 a fresh copy of the whole site with that one chunk replaced
//
// Usage: node demo/tools/make-attacks.mjs <chunk-path> [--demo-dir <dir>]
//   e.g. node demo/tools/make-attacks.mjs /_next/static/chunks/framework-b338f11e54b60304.js
//
// Pick <chunk-path> from the browser's network tab on the stake page — a JS chunk that loads
// before Stake is clicked — not by reading the bundle. --demo-dir redirects the whole set
// (used by the tests to run against copies of the fixtures).
import { createHash } from 'node:crypto';
import {
  cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { DEMO_DIR } from '../dirs.mjs';

const REPO_ROOT = dirname(DEMO_DIR);
const USAGE = 'usage: make-attacks.mjs <chunk-path> [--demo-dir <dir>]';
const PLACEHOLDERS = ['__ATTACKER__', '__CHAIN_ID__', '__ORIGIN__'];

function fail(message) {
  console.error(message);
  process.exit(1);
}

// viem lives in the workspace packages, not in dependency-free demo/. Resolve it from there.
function loadIsAddress() {
  for (const pkg of ['packages/core', 'packages/registry', 'apps/cli', 'apps/extension']) {
    try {
      return createRequire(join(REPO_ROOT, pkg, 'package.json'))('viem').isAddress;
    } catch {
      // Try the next workspace package.
    }
  }
  return fail('could not load viem (isAddress); run `pnpm i` at the repo root');
}

/** Joining onto "/" collapses every "..", so a chunk path can't climb out of the site dir. */
function toRelative(path) {
  return join('/', path).slice(1);
}

function isEmptyOrMissing(dir) {
  try {
    return readdirSync(dir).length === 0;
  } catch (err) {
    if (err.code === 'ENOENT') return true;
    throw err;
  }
}

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

function parse() {
  let parsed;
  try {
    parsed = parseArgs({ allowPositionals: true, options: { 'demo-dir': { type: 'string' } } });
  } catch (err) {
    return fail(`${err.message}\n${USAGE}`);
  }
  const [chunk, ...extra] = parsed.positionals;
  if (!chunk || extra.length > 0) return fail(USAGE);
  return { chunk: toRelative(chunk), demoDir: parsed.values['demo-dir'] ?? DEMO_DIR };
}

const { chunk, demoDir } = parse();
const isAddress = loadIsAddress();

const siteDir = join(demoDir, 'site');
const tamperedDir = join(demoDir, 'tampered');
const cloneDir = join(demoDir, 'clone');
const genuineFile = join(siteDir, chunk);

if (isEmptyOrMissing(siteDir)) fail(`demo/site is empty; nothing to tamper (${siteDir})`);
if (!existsSync(genuineFile) || !statSync(genuineFile).isFile()) {
  fail(`no such chunk in the site build: ${chunk}`);
}

// 1. Generate the payload from the template with config baked in.
const config = JSON.parse(readFileSync(join(demoDir, 'config.json'), 'utf8'));
if (!isAddress(config.attackerAddress)) {
  fail(`config.attackerAddress is not an address: ${config.attackerAddress}`);
}
if (!Number.isInteger(config.chainId)) fail(`config.chainId must be an integer: ${config.chainId}`);
if (typeof config.origin !== 'string') fail('config.origin must be a string');

const template = readFileSync(join(demoDir, 'attacker', 'payload.template.js'), 'utf8');
const payload = template
  .replaceAll('__ATTACKER__', config.attackerAddress)
  .replaceAll('__CHAIN_ID__', String(config.chainId))
  .replaceAll('__ORIGIN__', config.origin);
for (const ph of PLACEHOLDERS) {
  if (payload.includes(ph)) fail(`placeholder ${ph} was not substituted`);
}
writeFileSync(join(demoDir, 'attacker', 'evil.js'), payload);

// 2. Tamper the chunk: the genuine bytes, then the payload appended after a separator.
const genuine = readFileSync(genuineFile);
const tampered = Buffer.concat([genuine, Buffer.from(`\n;${payload}`)]);
mkdirSync(dirname(join(tamperedDir, chunk)), { recursive: true });
writeFileSync(join(tamperedDir, chunk), tampered);

// 3. Clone: a fresh copy of the whole site with that one chunk replaced the same way.
rmSync(cloneDir, { recursive: true, force: true });
cpSync(siteDir, cloneDir, { recursive: true, dereference: true });
writeFileSync(join(cloneDir, chunk), tampered);

console.log(`chunk:            ${chunk}`);
console.log(`genuine  sha256:  ${sha256(genuine)}`);
console.log(`tampered sha256:  ${sha256(tampered)}`);
console.log(`wrote ${join(demoDir, 'attacker', 'evil.js')}`);
console.log(`wrote ${join(tamperedDir, chunk)}`);
console.log(`wrote clone at ${cloneDir}`);
