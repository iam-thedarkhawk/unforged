// Drives make-attacks against copies of demo/fixtures in a temp dir: it is idempotent,
// the tampered chunk starts with the genuine bytes, the clone matches, and it refuses
// an empty site, a missing chunk, or a bad attacker address.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEMO = fileURLToPath(new URL('..', import.meta.url));
const TOOL = join(DEMO, 'tools', 'make-attacks.mjs');
const CHUNK = 'app.js';

/** A temp demo dir: fixtures/site as the site, plus the real config and payload template. */
function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'unforged-attacks-'));
  cpSync(join(DEMO, 'fixtures', 'site'), join(dir, 'site'), { recursive: true });
  mkdirSync(join(dir, 'attacker'), { recursive: true });
  cpSync(join(DEMO, 'attacker', 'payload.template.js'), join(dir, 'attacker', 'payload.template.js'));
  cpSync(join(DEMO, 'config.json'), join(dir, 'config.json'));
  return dir;
}

function run(dir, chunk = CHUNK) {
  return spawnSync(process.execPath, [TOOL, chunk, '--demo-dir', dir], { encoding: 'utf8' });
}

test('tampered chunk starts with the genuine bytes; clone matches it', (t) => {
  const dir = setup();
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const res = run(dir);
  assert.equal(res.status, 0, res.stderr);

  const genuine = readFileSync(join(dir, 'site', CHUNK));
  const tampered = readFileSync(join(dir, 'tampered', CHUNK));
  assert.ok(tampered.length > genuine.length);
  assert.ok(tampered.subarray(0, genuine.length).equals(genuine));

  const clone = readFileSync(join(dir, 'clone', CHUNK));
  assert.ok(clone.equals(tampered));

  const evil = readFileSync(join(dir, 'attacker', 'evil.js'), 'utf8');
  assert.ok(!evil.includes('__ATTACKER__'));
  assert.ok(evil.includes(JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8')).attackerAddress));
});

test('make-attacks is idempotent', (t) => {
  const dir = setup();
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  assert.equal(run(dir).status, 0);
  const tampered = readFileSync(join(dir, 'tampered', CHUNK));
  const evil = readFileSync(join(dir, 'attacker', 'evil.js'));

  assert.equal(run(dir).status, 0);
  assert.ok(readFileSync(join(dir, 'tampered', CHUNK)).equals(tampered));
  assert.ok(readFileSync(join(dir, 'attacker', 'evil.js')).equals(evil));
});

test('refuses an empty site', (t) => {
  const dir = setup();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  rmSync(join(dir, 'site'), { recursive: true, force: true });
  mkdirSync(join(dir, 'site'));
  assert.notEqual(run(dir).status, 0);
});

test('refuses a missing chunk', (t) => {
  const dir = setup();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  assert.notEqual(run(dir, 'does-not-exist.js').status, 0);
});

test('refuses a bad attacker address in config', (t) => {
  const dir = setup();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(
    join(dir, 'config.json'),
    JSON.stringify({ attackerAddress: '0xnotanaddress', chainId: 560048, origin: 'http://localhost:8080' }),
  );
  assert.notEqual(run(dir).status, 0);
});
