// Chooses which files the demo serves. Checked on every use, so use-build can run while the server is up.
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEMO_DIR = fileURLToPath(new URL('.', import.meta.url));

async function isEmptyOrMissing(dir) {
  try {
    return (await readdir(dir)).length === 0;
  } catch (err) {
    if (err.code === 'ENOENT') return true;
    throw err;
  }
}

/**
 * The set is all-or-nothing: with a real build in demo/site, a fixture must never
 * stand in for a missing tampered copy or clone.
 */
export async function servedDirs() {
  const useFixtures = await isEmptyOrMissing(join(DEMO_DIR, 'site'));
  const root = useFixtures ? join(DEMO_DIR, 'fixtures') : DEMO_DIR;
  return { site: join(root, 'site'), tampered: join(root, 'tampered'), clone: join(root, 'clone') };
}
