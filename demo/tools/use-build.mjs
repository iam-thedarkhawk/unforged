// Replaces demo/site with a Lido build. Usage: node demo/tools/use-build.mjs <out-dir>
import { cpSync, existsSync, realpathSync, rmSync, statSync } from 'node:fs';
import { join, relative, resolve, isAbsolute } from 'node:path';
import { DEMO_DIR } from '../dirs.mjs';

const SITE_DIR = join(realpathSync(DEMO_DIR), 'site');

function fail(message) {
  console.error(message);
  process.exit(1);
}

function isSameOrInside(dir, parent) {
  const path = relative(parent, dir);
  return path === '' || (!path.startsWith('..') && !isAbsolute(path));
}

/** Runs before the wipe, so a bad argument leaves the current site in place. */
function checkedOutDir(args) {
  if (args.length !== 1) fail('usage: use-build.mjs <out-dir>');
  const [arg] = args;
  if (!existsSync(arg) || !statSync(arg).isDirectory()) fail(`not a directory: ${arg}`);

  const outDir = realpathSync(resolve(arg));
  if (!existsSync(join(outDir, 'index.html'))) fail(`no index.html in ${outDir}; is this a build's out/?`);
  // Wiping demo/site would destroy a source inside it, and a parent can't be copied into its own child.
  if (isSameOrInside(outDir, SITE_DIR) || isSameOrInside(SITE_DIR, outDir)) {
    fail(`${outDir} overlaps demo/site`);
  }
  return outDir;
}

const outDir = checkedOutDir(process.argv.slice(2));
rmSync(SITE_DIR, { recursive: true, force: true });
// dereference: demo/site must hold the real bytes, not links back into the build.
cpSync(outDir, SITE_DIR, { recursive: true, dereference: true });
console.log(`demo/site now holds ${outDir}`);
