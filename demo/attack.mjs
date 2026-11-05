// Switches the demo server's mode by writing state.json.
// Usage: node attack.mjs <reset|swap|inject|hijack> [--target <path>]
import { existsSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const DEMO_DIR = fileURLToPath(new URL('.', import.meta.url));
const STATE_FILE = join(DEMO_DIR, 'state.json');
const MODES = ['reset', 'swap', 'inject', 'hijack'];
const USAGE = 'usage: attack.mjs <reset|swap|inject|hijack> [--target <path>]';

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseState() {
  let parsed;
  try {
    parsed = parseArgs({ allowPositionals: true, options: { target: { type: 'string' } } });
  } catch (err) {
    fail(`${err.message}\n${USAGE}`);
  }
  const [mode, ...extra] = parsed.positionals;
  if (!MODES.includes(mode) || extra.length > 0) fail(USAGE);
  if (mode !== 'swap') return { mode };

  const { target } = parsed.values;
  if (!target) fail('swap needs --target <path>, the file to replace');
  // A mistyped target would match no request and leave the genuine site up, mid-demo.
  if (!existsSync(join(DEMO_DIR, 'tampered', target))) fail(`no tampered copy: demo/tampered/${target}`);
  return { mode, target };
}

const state = parseState();
// Rename so the server, which reads on every request, never sees a half-written file.
writeFileSync(`${STATE_FILE}.tmp`, `${JSON.stringify(state)}\n`);
renameSync(`${STATE_FILE}.tmp`, STATE_FILE);
console.log(`state: ${JSON.stringify(state)}`);
